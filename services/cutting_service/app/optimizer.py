from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass

from .schemas import Part, Placement, UnplacedPart


@dataclass(frozen=True)
class _PartInstance:
    name: str
    width: int
    height: int
    sequence: int

    @property
    def area(self) -> int:
        return self.width * self.height

    @property
    def max_side(self) -> int:
        return max(self.width, self.height)

    @property
    def min_side(self) -> int:
        return min(self.width, self.height)


@dataclass(frozen=True)
class _Rect:
    x: int
    y: int
    width: int
    height: int

    @property
    def area(self) -> int:
        return self.width * self.height


@dataclass(frozen=True)
class _Candidate:
    part_index: int
    free_rect: _Rect
    width: int
    height: int
    rotated: bool
    score: tuple[int, ...]


def expand_parts(parts: list[Part]) -> list[_PartInstance]:
    result: list[_PartInstance] = []
    sequence = 0
    for part in parts:
        for _ in range(part.quantity):
            result.append(_PartInstance(part.name, part.width, part.height, sequence))
            sequence += 1
    return result


@dataclass(frozen=True)
class _PackResult:
    placements: tuple[Placement, ...]
    unplaced: tuple[_PartInstance, ...]
    total_sheets: int
    sheet_bounds: tuple[tuple[int, int], ...]


def _candidate_sizes(width: int, height: int, sheet_width: int, sheet_height: int) -> list[tuple[int, int, bool]]:
    sizes: list[tuple[int, int, bool]] = []
    if width <= sheet_width and height <= sheet_height:
        sizes.append((width, height, False))
    if width != height and height <= sheet_width and width <= sheet_height:
        sizes.append((height, width, True))
    return sizes


def _intersects(a: _Rect, b: _Rect) -> bool:
    return a.x < b.x + b.width and a.x + a.width > b.x and a.y < b.y + b.height and a.y + a.height > b.y


def _contains(outer: _Rect, inner: _Rect) -> bool:
    return (
        inner.x >= outer.x
        and inner.y >= outer.y
        and inner.x + inner.width <= outer.x + outer.width
        and inner.y + inner.height <= outer.y + outer.height
    )


def _split_free_rect(free: _Rect, used: _Rect) -> list[_Rect]:
    if not _intersects(free, used):
        return [free]

    split: list[_Rect] = []
    free_right = free.x + free.width
    free_bottom = free.y + free.height
    used_right = used.x + used.width
    used_bottom = used.y + used.height

    if used.y > free.y:
        split.append(_Rect(free.x, free.y, free.width, used.y - free.y))
    if used_bottom < free_bottom:
        split.append(_Rect(free.x, used_bottom, free.width, free_bottom - used_bottom))
    if used.x > free.x:
        split.append(_Rect(free.x, free.y, used.x - free.x, free.height))
    if used_right < free_right:
        split.append(_Rect(used_right, free.y, free_right - used_right, free.height))

    return [rect for rect in split if rect.width > 0 and rect.height > 0]


def _prune_free_rects(rects: list[_Rect]) -> list[_Rect]:
    pruned: list[_Rect] = []
    for index, rect in enumerate(rects):
        if any(index != other_index and _contains(other, rect) for other_index, other in enumerate(rects)):
            continue
        if rect not in pruned:
            pruned.append(rect)
    return pruned


def _candidate_score(
    heuristic: str,
    free_rect: _Rect,
    cand_w: int,
    cand_h: int,
    part: _PartInstance,
) -> tuple[int, ...]:
    leftover_w = free_rect.width - cand_w
    leftover_h = free_rect.height - cand_h
    short_side = min(leftover_w, leftover_h)
    long_side = max(leftover_w, leftover_h)
    area_waste = free_rect.area - cand_w * cand_h
    right = free_rect.x + cand_w
    bottom = free_rect.y + cand_h

    common = (bottom, right, free_rect.y, free_rect.x, part.sequence)
    if heuristic == "best_area":
        return (area_waste, short_side, long_side, *common)
    if heuristic == "best_long_side":
        return (long_side, short_side, area_waste, *common)
    if heuristic == "bottom_left":
        return (bottom, right, area_waste, short_side, free_rect.y, free_rect.x, part.sequence)
    return (short_side, long_side, area_waste, *common)


def _find_best_candidate(
    sheet_width: int,
    sheet_height: int,
    free_rects: list[_Rect],
    remaining: list[_PartInstance],
    heuristic: str,
) -> _Candidate | None:
    best: _Candidate | None = None
    for part_index, part in enumerate(remaining):
        for cand_w, cand_h, rotated in _candidate_sizes(part.width, part.height, sheet_width, sheet_height):
            for free_rect in free_rects:
                if cand_w > free_rect.width or cand_h > free_rect.height:
                    continue
                score = _candidate_score(heuristic, free_rect, cand_w, cand_h, part)
                candidate = _Candidate(part_index, free_rect, cand_w, cand_h, rotated, score)
                if best is None or candidate.score < best.score:
                    best = candidate
    return best


def _pack_maxrects(
    sheet_width: int,
    sheet_height: int,
    ordered_parts: list[_PartInstance],
    heuristic: str,
) -> _PackResult:
    remaining = [
        part
        for part in ordered_parts
        if _candidate_sizes(part.width, part.height, sheet_width, sheet_height)
    ]
    impossible = tuple(
        part
        for part in ordered_parts
        if not _candidate_sizes(part.width, part.height, sheet_width, sheet_height)
    )
    placements: list[Placement] = []
    sheet_bounds: list[tuple[int, int]] = []
    sheet_index = 0

    while remaining:
        free_rects = [_Rect(0, 0, sheet_width, sheet_height)]
        placed_on_sheet = 0
        used_right = 0
        used_bottom = 0

        while remaining:
            candidate = _find_best_candidate(sheet_width, sheet_height, free_rects, remaining, heuristic)
            if candidate is None:
                break

            part = remaining.pop(candidate.part_index)
            used = _Rect(candidate.free_rect.x, candidate.free_rect.y, candidate.width, candidate.height)
            placements.append(
                Placement(
                    name=part.name,
                    x=used.x,
                    y=used.y,
                    width=used.width,
                    height=used.height,
                    sheet_index=sheet_index,
                    rotated=candidate.rotated,
                )
            )
            used_right = max(used_right, used.x + used.width)
            used_bottom = max(used_bottom, used.y + used.height)

            next_free: list[_Rect] = []
            for free_rect in free_rects:
                next_free.extend(_split_free_rect(free_rect, used))
            free_rects = _prune_free_rects(next_free)
            placed_on_sheet += 1

        if placed_on_sheet == 0:
            impossible = (*impossible, *remaining)
            break

        sheet_bounds.append((used_right, used_bottom))
        sheet_index += 1

    return _PackResult(
        placements=tuple(placements),
        unplaced=impossible,
        total_sheets=sheet_index,
        sheet_bounds=tuple(sheet_bounds),
    )


def _pack_with_sort(
    sheet_width: int,
    sheet_height: int,
    parts: list[Part],
    sort_key: Callable[[_PartInstance], tuple[int, ...]],
    heuristic: str,
) -> _PackResult:
    expanded = expand_parts(parts)
    expanded.sort(key=sort_key, reverse=True)
    return _pack_maxrects(sheet_width, sheet_height, expanded, heuristic)


def optimize_sheet(sheet_width: int, sheet_height: int, parts: list[Part]) -> tuple[list[Placement], list[UnplacedPart], int]:
    """
    Multi-sheet MaxRects packing with 90° rotation per part instance.
    Optimizes for fewer sheets first, then denser and more compact layouts.
    """
    if not parts:
        return [], [], 0

    sort_strategies = [
        lambda item: (item.area, item.max_side, item.min_side, -item.sequence),
        lambda item: (item.max_side, item.area, item.min_side, -item.sequence),
        lambda item: (item.min_side, item.area, item.max_side, -item.sequence),
        lambda item: (item.width, item.height, item.area, -item.sequence),
        lambda item: (item.height, item.width, item.area, -item.sequence),
    ]
    heuristics = ["best_short_side", "best_area", "best_long_side", "bottom_left"]

    best: _PackResult | None = None
    for sort_key in sort_strategies:
        for heuristic in heuristics:
            result = _pack_with_sort(sheet_width, sheet_height, parts, sort_key, heuristic)
            if best is None or _result_score(result) < _result_score(best):
                best = result

    assert best is not None
    grouped = Counter((part.name, part.width, part.height) for part in best.unplaced)
    unplaced_parts = [
        UnplacedPart(name=name, width=width, height=height, quantity=qty)
        for (name, width, height), qty in grouped.items()
    ]
    return list(best.placements), unplaced_parts, best.total_sheets


def _result_score(result: _PackResult) -> tuple[int, ...]:
    if not result.placements:
        return (result.total_sheets, len(result.unplaced), 0, 0, 0)

    used_area = sum(placement.width * placement.height for placement in result.placements)
    bounds_area = sum(width * height for width, height in result.sheet_bounds)
    max_bottom = max((placement.y + placement.height for placement in result.placements), default=0)
    max_right = max((placement.x + placement.width for placement in result.placements), default=0)

    return (
        result.total_sheets,
        len(result.unplaced),
        -len(result.placements),
        bounds_area - used_area,
        max_bottom,
        max_right,
    )
