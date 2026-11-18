export async function coverFromVideo(file: File): Promise<Blob> {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(reject, 8000);
      video.onloadeddata = () => { window.clearTimeout(timeout); resolve(); };
      video.onerror = () => { window.clearTimeout(timeout); reject(); };
      video.preload = "auto";
      video.src = url;
    });
    if (!video.videoWidth || !video.videoHeight) throw new Error("Video has no readable frame");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not open a canvas");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const cover = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!cover) throw new Error("Could not create a cover image");
    return cover;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
