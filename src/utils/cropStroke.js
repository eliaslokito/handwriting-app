/**
 * cropStroke.js
 * Utilidad para recortar un trazo capturado al área mínima con tinta.
 *
 * Algoritmo:
 * 1. Dibuja el dataUrl en un canvas offscreen
 * 2. Escanea píxel por píxel buscando el bounding box del trazo
 * 3. Recorta esa región con padding de 8px
 * 4. Devuelve un nuevo dataUrl de la imagen recortada
 *
 * Esto garantiza que todos los trazos guardados tengan el mismo
 * tamaño relativo sin importar qué tan grande o pequeño escribió el usuario.
 */

const PADDING = 8; // px de margen alrededor del trazo

/**
 * Recorta un dataUrl al bounding box de sus píxeles no transparentes.
 * @param {string} dataUrl - PNG en base64 del trazo completo
 * @returns {Promise<string>} - PNG en base64 recortado
 */
export async function cropStroke(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Canvas auxiliar para leer píxeles
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width  = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext('2d');
      srcCtx.drawImage(img, 0, 0);

      const { data, width, height } = srcCtx.getImageData(0, 0, img.width, img.height);

      // Buscar límites del trazo (píxeles con alpha > 0)
      let minX = width, maxX = 0, minY = height, maxY = 0;
      let found = false;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 10) { // umbral para ignorar artefactos
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      // Si no hay trazos detectados, devolver original
      if (!found) {
        resolve(dataUrl);
        return;
      }

      // Aplicar padding sin salirse del canvas
      minX = Math.max(0, minX - PADDING);
      minY = Math.max(0, minY - PADDING);
      maxX = Math.min(width  - 1, maxX + PADDING);
      maxY = Math.min(height - 1, maxY + PADDING);

      const cropW = maxX - minX;
      const cropH = maxY - minY;

      if (cropW <= 0 || cropH <= 0) {
        resolve(dataUrl);
        return;
      }

      // Canvas de destino con solo la región recortada
      const dstCanvas = document.createElement('canvas');
      dstCanvas.width  = cropW;
      dstCanvas.height = cropH;
      const dstCtx = dstCanvas.getContext('2d');

      dstCtx.drawImage(
        srcCanvas,
        minX, minY, cropW, cropH, // fuente
        0,    0,    cropW, cropH  // destino
      );

      resolve(dstCanvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('No se pudo cargar el trazo para recortar'));
    img.src = dataUrl;
  });
}
