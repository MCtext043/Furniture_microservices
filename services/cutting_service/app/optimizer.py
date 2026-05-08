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
            if width > sheet_width or height > sheet_height:
                impossible.append((name, width, height))
                continue

            if x + width > sheet_width:
                x = 0
                y += shelf_height
                shelf_height = 0

            if y + height > sheet_height:
                next_remaining.append((name, width, height))
                continue

            placements.append(
                Placement(
                    name=name,
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    sheet_index=sheet_index,
                )
            )
            x += width
            shelf_height = max(shelf_height, height)
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
