// Convertit toute image (File/Blob) en WebP compressé.
// Utilisable partout : avatars, annonces, événements, newsletter, galerie.
//
// Usage:
//   const webpFile = await imageToWebp(file, { maxWidth: 1600, quality: 0.82 });
//   sb.storage.from('bucket').upload(path, webpFile, { contentType: 'image/webp' });
//
// Options:
//   maxWidth (default 1600)    : redimensionne si l'image est plus large
//   quality  (default 0.82)    : qualité WebP (0-1)
//   force    (default false)   : convertit même les GIF (attention : perd l'animation)

(function () {
  const SUPPORTS_WEBP = (() => {
    try {
      const c = document.createElement('canvas');
      return c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch (_) { return false; }
  })();

  async function imageToWebp(file, opts = {}) {
    if (!file) return file;
    const maxWidth = opts.maxWidth || 1600;
    const quality  = opts.quality  || 0.82;
    const force    = opts.force    || false;

    // Si déjà WebP, on redimensionne quand même si trop large
    // Si GIF (animé), on ne touche pas sauf force
    const type = file.type || '';
    if (!type.startsWith('image/')) return file;
    if (type === 'image/gif' && !force) return file;
    if (!SUPPORTS_WEBP) return file;

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxWidth) {
          h = Math.round(h * (maxWidth / w));
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            // Si le WebP est plus lourd que l'original, on garde l'original
            if (blob.size > file.size * 0.95) { resolve(file); return; }
            // Renomme .jpg/.png → .webp
            const originalName = (file.name || 'image').replace(/\.[a-z]+$/i, '');
            const webpFile = new File([blob], originalName + '.webp', {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // Version raccourcie pour avatars (carré 400x400)
  async function imageToAvatarWebp(file) {
    return imageToWebp(file, { maxWidth: 400, quality: 0.82 });
  }

  window.imageToWebp = imageToWebp;
  window.imageToAvatarWebp = imageToAvatarWebp;
})();
