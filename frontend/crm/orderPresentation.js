const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "3gp", "ogv"]);

export function crmStatusLabel(status) {
  if (typeof status === "string" && status.trim().toLocaleLowerCase("ru") === "new") return "Новая";
  return status ?? "";
}

export function crmMediaType(value) {
  const extension = String(value || "").split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.has(extension) ? "video" : "image";
}
