from collections import Counter

from .schemas import Part, Placement, UnplacedPart


def expand_parts(parts: list[Part]) -> list[tuple[str, int, int]]:
    result: list[tuple[str, int, int]] = []
    for part in parts:
        for _ in range(part.quantity):
            result.append((part.name, part.width, part.height))
    result.sort(key=lambda item: item[1] * item[2], reverse=True)
    return result


def optimize_sheet(sheet_width: int, sheet_height: int, parts: list[Part]) -> tuple[list[Placement], list[UnplacedPart], int]:
    """
    Multi-sheet shelf packing:
    - If a detail does not fit current sheet, it is moved to next sheet
    - If a detail is bigger than sheet dimensions, it is marked as unplaced
    """
    placements: list[Placement] = []
    remaining: list[tuple[str, int, int]] = expand_parts(parts)
    impossible: list[tuple[str, int, int]] = []
    sheet_index = 0

    while remaining:
        x = 0
        y = 0
        shelf_height = 0
        next_remaining: list[tuple[str, int, int]] = []
        placed_on_sheet = 0

        for name, width, height in remaining:
            candidate_sizes: list[tuple[int, int]] = [(width, height)]
            if width != height:
                candidate_sizes.append((height, width))

            valid_sizes = [(w, h) for w, h in candidate_sizes if w <= sheet_width and h <= sheet_height]
            if not valid_sizes:
                impossible.append((name, width, height))
                continue

            best_fit: tuple[int, int, int, int] | None = None
            chosen_w = 0
            chosen_h = 0
            chosen_shelf = 0
            for cand_w, cand_h in valid_sizes:
                nx = x
                ny = y
                nshelf = shelf_height
                if nx + cand_w > sheet_width:
                    nx = 0
                    ny += nshelf
                    nshelf = 0
                if ny + cand_h > sheet_height:
                    continue
                score = ny + cand_h
                score_width = nx + cand_w
                if best_fit is None or (score, score_width) < (best_fit[0], best_fit[1]):
                    best_fit = (score, score_width, nx, ny)
                    chosen_w = cand_w
                    chosen_h = cand_h
                    chosen_shelf = nshelf

            if best_fit is None:
                next_remaining.append((name, width, height))
                continue

            nx = best_fit[2]
            ny = best_fit[3]
            placements.append(
                Placement(
                    name=name,
                    x=nx,
                    y=ny,
                    width=chosen_w,
                    height=chosen_h,
                    sheet_index=sheet_index,
                )
            )
            x = nx + chosen_w
            y = ny
            shelf_height = max(chosen_shelf, chosen_h)
            placed_on_sheet += 1

        if placed_on_sheet == 0:
            # No fit on an empty sheet - prevent infinite loop.
            impossible.extend(next_remaining)
            break

        remaining = next_remaining
        sheet_index += 1

    grouped = Counter(impossible)
    unplaced_parts = [
        UnplacedPart(name=name, width=width, height=height, quantity=qty)
        for (name, width, height), qty in grouped.items()
    ]
    total_sheets = max((p.sheet_index for p in placements), default=-1) + 1
    return placements, unplaced_parts, total_sheets
