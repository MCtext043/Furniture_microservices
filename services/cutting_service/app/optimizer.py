from .schemas import Part, Placement


def expand_parts(parts: list[Part]) -> list[tuple[str, int, int]]:
    result: list[tuple[str, int, int]] = []
    for part in parts:
        for _ in range(part.quantity):
            result.append((part.name, part.width, part.height))
    result.sort(key=lambda item: item[1] * item[2], reverse=True)
    return result


def optimize_sheet(sheet_width: int, sheet_height: int, parts: list[Part]) -> list[Placement]:
    placements: list[Placement] = []
    x = 0
    y = 0
    shelf_height = 0

    for name, width, height in expand_parts(parts):
        if width > sheet_width or height > sheet_height:
            continue

        if x + width > sheet_width:
            x = 0
            y += shelf_height
            shelf_height = 0

        if y + height > sheet_height:
            continue

        placements.append(Placement(name=name, x=x, y=y, width=width, height=height))
        x += width
        shelf_height = max(shelf_height, height)

    return placements
