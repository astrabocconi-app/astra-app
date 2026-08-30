const { withDangerousMod, IOSConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Strip the alpha channel from the generated alternate app icon.
 *
 * expo-alternate-app-icons resizes the source with jimp and writes the buffer
 * straight into Images.xcassets (see its generateUniversalIcon.js). jimp encodes
 * PNG as RGBA, so the icon that ends up in the asset catalog carries an alpha
 * channel EVEN WHEN THE SOURCE FILE HAS NONE — flattening assets/icon-inverted.png
 * is not enough, which is exactly the trap this plugin exists to close. Apple
 * rejects app icon assets containing an alpha channel, and Expo's own pipeline
 * correctly strips it for the primary AppIcon, so the alternate one is the only
 * icon in the bundle that would ship with alpha.
 *
 * Rather than re-encode (which would mean depending on an image library at
 * prebuild time), we put the original file back: it is already the exact size
 * the plugin generates and is already opaque, so a copy is both simpler and
 * lossless. If either assumption stops holding, the build fails loudly here
 * instead of at App Store validation.
 */

/** PNG colour types that carry alpha: 4 = grey+alpha, 6 = truecolour+alpha. */
const ALPHA_COLOR_TYPES = new Set([4, 6]);

/** Read width/height/colourType straight out of the PNG's IHDR chunk. */
function readPngHeader(file) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(26);
    fs.readSync(fd, buf, 0, 26, 0);
    if (buf.toString("ascii", 1, 4) !== "PNG") return null;
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      colorType: buf.readUInt8(25),
    };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * @param config Expo config
 * @param props.name  Alternate icon name, matching app.config.ts
 * @param props.source Project-relative path to the opaque source icon
 */
const withOpaqueAlternateIcon = (config, { name, source }) =>
  withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const iconSetDir = path.join(
        projectRoot,
        "ios",
        projectName,
        `Images.xcassets/${name}.appiconset`,
      );

      if (!fs.existsSync(iconSetDir)) {
        // The icon plugin runs before us; if the set is missing, the icon
        // silently would not ship at all, so say so rather than pass quietly.
        console.warn(`[opaque-alternate-icon] ${name}.appiconset not found — skipped.`);
        return cfg;
      }

      const srcPath = path.join(projectRoot, source);
      const srcHeader = readPngHeader(srcPath);
      if (!srcHeader) throw new Error(`[opaque-alternate-icon] ${source} is not a PNG.`);
      if (ALPHA_COLOR_TYPES.has(srcHeader.colorType)) {
        throw new Error(
          `[opaque-alternate-icon] ${source} still has an alpha channel (PNG colour type ` +
            `${srcHeader.colorType}). Flatten it onto a solid background before building — ` +
            `Apple rejects app icons with alpha.`,
        );
      }

      for (const file of fs.readdirSync(iconSetDir)) {
        if (!file.toLowerCase().endsWith(".png")) continue;
        const target = path.join(iconSetDir, file);
        const header = readPngHeader(target);
        if (!header || !ALPHA_COLOR_TYPES.has(header.colorType)) continue;

        if (header.width !== srcHeader.width || header.height !== srcHeader.height) {
          throw new Error(
            `[opaque-alternate-icon] ${file} is ${header.width}x${header.height} but the source ` +
              `is ${srcHeader.width}x${srcHeader.height}. The copy-back shortcut assumes they ` +
              `match; resize the source or replace this plugin with a real re-encode.`,
          );
        }

        fs.copyFileSync(srcPath, target);
        console.log(`[opaque-alternate-icon] stripped alpha from ${name}.appiconset/${file}`);
      }

      return cfg;
    },
  ]);

module.exports = withOpaqueAlternateIcon;
