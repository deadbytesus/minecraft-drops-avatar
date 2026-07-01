interface MojangProfileProperty {
  name: string;
  value: string;
  signature?: string;
}

const DROPS_GW = 28,
  DROPS_GH = 32;

export function avDropsRenderSkin(skin: HTMLImageElement, ov: boolean): HTMLCanvasElement {
  // Returns a 28×32 native-resolution canvas with the Drops avatar painted.
  // Uses proper Minecraft skin layout — player's right arm (viewer-left) from
  // (44,20), player's left arm (viewer-right) from (36,52) on modern 64×64
  // skins. Legacy 64×32 skins (no left-arm/leg region) mirror the right side.
  const GW = DROPS_GW,
    GH = DROPS_GH;

  const tmp = document.createElement("canvas");
  tmp.width = 64;
  tmp.height = 64;

  const tctx = tmp.getContext("2d");
  if (!tctx) throw new Error("Could not get 2D context for temporary canvas");

  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(skin, 0, 0);

  const sd = tctx.getImageData(0, 0, 64, 64).data;
  const legacy = (skin.naturalHeight || skin.height || 64) <= 32; // 64x32 skin → no left arm/leg region

  function px(x: number, y: number): [number, number, number, number] {
    const i = (y * 64 + x) * 4;
    return [sd[i], sd[i + 1], sd[i + 2], sd[i + 3]];
  }

  function shade(c: [number, number, number, number], f: number): [number, number, number, number] {
    return [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f), c[3]];
  }

  const av = document.createElement("canvas");
  av.width = GW;
  av.height = GH;

  const actx = av.getContext("2d");
  if (!actx) throw new Error("Could not get 2D context for avatar canvas");

  const aimg = actx.createImageData(GW, GH);

  function setChunk(cx: number, cy: number, c: [number, number, number, number]): void {
    if (cx < 0 || cx >= GW || cy < 0 || cy >= GH) return;
    const i = (cy * GW + cx) * 4;
    aimg.data[i] = c[0];
    aimg.data[i + 1] = c[1];
    aimg.data[i + 2] = c[2];
    aimg.data[i + 3] = c[3];
  }

  function getChunk(cx: number, cy: number): [number, number, number, number] {
    const i = (cy * GW + cx) * 4;
    return [aimg.data[i], aimg.data[i + 1], aimg.data[i + 2], aimg.data[i + 3]];
  }

  function fillBase(
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    sx0: number,
    sy0: number,
    sx1: number,
    sy1: number,
    factor?: number,
    flipX?: boolean,
  ): void {
    factor = factor || 1;
    const dw = c1 - c0,
      dh = r1 - r0,
      sw = sx1 - sx0,
      sh = sy1 - sy0;

    for (let dy = 0; dy < dh; dy++) {
      for (let dx = 0; dx < dw; dx++) {
        const srcDx = flipX ? dw - 1 - dx : dx;
        const sx = sx0 + Math.floor((srcDx * sw) / dw),
          sy = sy0 + Math.floor((dy * sh) / dh);
        let p = px(sx, sy);
        if (factor !== 1) p = shade(p, factor);
        setChunk(c0 + dx, r0 + dy, p);
      }
    }
  }

  function copyOverlay(
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    sx0: number,
    sy0: number,
    sx1: number,
    sy1: number,
    factor?: number,
    flipX?: boolean,
  ): void {
    factor = factor || 1;
    const dw = c1 - c0,
      dh = r1 - r0,
      sw = sx1 - sx0,
      sh = sy1 - sy0;

    /* Overlay dominance: any non-zero overlay pixel replaces the chunk
       (including its own translucent alpha), so the overlay's transparency
       composites to the FINAL background rather than getting muddied by an
       opaque base underneath. Fully transparent overlay pixels keep the base. */
    for (let dy = 0; dy < dh; dy++) {
      for (let dx = 0; dx < dw; dx++) {
        const srcDx = flipX ? dw - 1 - dx : dx;
        const sx = sx0 + Math.floor((srcDx * sw) / dw),
          sy = sy0 + Math.floor((dy * sh) / dh);
        const p = px(sx, sy);
        if (p[3] === 0) continue;
        setChunk(c0 + dx, r0 + dy, factor !== 1 ? shade(p, factor) : p);
      }
    }
  }

  function fillFaceSquish(
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    sx0: number,
    sy0: number,
    sx1: number,
    sy1: number,
    overlayMode: boolean,
  ): void {
    const colWidths = [2, 2, 2, 1, 1, 2, 2, 2];
    const dh = r1 - r0,
      sh = sy1 - sy0;
    let dx = 0;

    for (let sxOff = 0; sxOff < 8; sxOff++) {
      const w = colWidths[sxOff];
      for (let dy = 0; dy < dh; dy++) {
        const sy = sy0 + Math.floor((dy * sh) / dh),
          sx = sx0 + sxOff;
        const p = px(sx, sy);
        if (overlayMode && p[3] === 0) continue;
        for (let i = 0; i < w; i++) {
          setChunk(c0 + dx + i, r0 + dy, p);
        }
      }
      dx += w;
    }
  }

  function shadeOutline(c0: number, r0: number, c1: number, r1: number, factor?: number): void {
    factor = factor || 0.7;
    for (let x = c0; x < c1; x++) {
      let c = getChunk(x, r0);
      setChunk(x, r0, shade(c, factor));
      c = getChunk(x, r1 - 1);
      setChunk(x, r1 - 1, shade(c, factor));
    }
    for (let y = r0 + 1; y < r1 - 1; y++) {
      let c = getChunk(c0, y);
      setChunk(c0, y, shade(c, factor));
      c = getChunk(c1 - 1, y);
      setChunk(c1 - 1, y, shade(c, factor));
    }
  }

  // ── BASE ──
  fillFaceSquish(2, 5, 16, 21, 8, 8, 16, 16, false); // FACE
  fillBase(16, 5, 24, 21, 16, 8, 24, 16, 0.78); // HEAD SIDE base + depth
  fillBase(6, 21, 17, 25, 20, 20, 28, 32); // BODY

  // ARM (viewer-LEFT = player's RIGHT): source 44,20
  fillBase(3, 21, 6, 25, 44, 20, 48, 31);
  fillBase(3, 25, 6, 26, 44, 31, 48, 32);

  // ARM (viewer-RIGHT = player's LEFT): modern skins have left arm at 36,52; legacy mirrors right arm
  if (legacy) {
    fillBase(17, 21, 24, 25, 44, 20, 48, 31, 1, true);
    fillBase(17, 25, 24, 26, 44, 31, 48, 32, 1, true);
  } else {
    fillBase(17, 21, 24, 25, 36, 52, 40, 63);
    fillBase(17, 25, 24, 26, 36, 63, 40, 64);
  }

  // subtle depth shade on outer edge of the canvas-right arm
  for (let cy = 21; cy < 26; cy++) {
    for (let cx = 21; cx < 24; cx++) {
      const c = getChunk(cx, cy);
      setChunk(cx, cy, shade(c, 0.88));
    }
  }

  // LEG (viewer-LEFT = player's RIGHT): source 4,20
  fillBase(6, 25, 12, 27, 4, 20, 8, 31);
  fillBase(6, 27, 12, 28, 4, 31, 8, 32);

  // LEG (viewer-RIGHT = player's LEFT): modern skins have left leg at 20,52; legacy mirrors right leg
  if (legacy) {
    fillBase(12, 25, 17, 27, 4, 20, 8, 31, 1, true);
    fillBase(12, 27, 17, 28, 4, 31, 8, 32, 1, true);
  } else {
    fillBase(12, 25, 17, 27, 20, 52, 24, 63);
    fillBase(12, 27, 17, 28, 20, 63, 24, 64);
  }

  // LEG SIDE depth (darkened outside edge)
  fillBase(17, 26, 19, 27, 4, 20, 8, 31, 0.82);
  fillBase(17, 27, 19, 28, 4, 31, 8, 32, 0.82);

  // OUTLINES (on base only)
  shadeOutline(2, 5, 16, 21);
  shadeOutline(16, 5, 24, 21);
  shadeOutline(3, 21, 6, 26);
  shadeOutline(17, 21, 24, 26);
  shadeOutline(6, 25, 12, 28);
  shadeOutline(12, 25, 17, 28);

  // ── OVERLAYS on top ── (jacket, hat, sleeves, pants)
  if (ov) {
    fillFaceSquish(2, 5, 16, 21, 40, 8, 48, 16, true); // hat front
    copyOverlay(17, 5, 25, 21, 48, 8, 56, 16, 0.78); // hat side

    // jacket (body overlay) 20,36,8,12
    copyOverlay(6, 21, 17, 25, 20, 36, 28, 48);

    // arm overlay viewer-left = player's right arm overlay (44,36)
    copyOverlay(3, 21, 6, 25, 44, 36, 48, 47);
    copyOverlay(3, 25, 6, 26, 44, 47, 48, 48);

    // arm overlay viewer-right: modern has 52,52; legacy mirrors
    if (legacy) {
      copyOverlay(17, 21, 24, 25, 44, 36, 48, 47, 1, true);
      copyOverlay(17, 25, 24, 26, 44, 47, 48, 48, 1, true);
    } else {
      copyOverlay(17, 21, 24, 25, 52, 52, 56, 63);
      copyOverlay(17, 25, 24, 26, 52, 63, 56, 64);
    }

    // leg overlay viewer-left = player's right leg overlay (4,36)
    copyOverlay(6, 25, 12, 27, 4, 36, 8, 47);
    copyOverlay(6, 27, 12, 28, 4, 47, 8, 48);

    // leg overlay viewer-right: modern has 4,52; legacy mirrors right leg overlay
    if (legacy) {
      copyOverlay(12, 25, 17, 27, 4, 36, 8, 47, 1, true);
      copyOverlay(12, 27, 17, 28, 4, 47, 8, 48, 1, true);
    } else {
      copyOverlay(12, 25, 17, 27, 4, 52, 8, 63);
      copyOverlay(12, 27, 17, 28, 4, 63, 8, 64);
    }
  }

  actx.putImageData(aimg, 0, 0);
  return av;
}

// Helper to transform an image URL into an HTMLImageElement
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Essential for reading pixel data via canvas later
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load skin image asset"));
    img.src = url;
  });
}

/**
 * Fetches a player's skin by username using the official Mojang API.
 * Performs a two-step lookup: resolves username to UUID, then fetches texture session.
 */
export async function getSkinUrlByUsername(username: string): Promise<string> {
  // Step 1: Resolve player's username into their unique alphanumeric ID
  const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
  if (!profileRes.ok) throw new Error("Minecraft player profile not found");
  const profileData = await profileRes.json();
  const uuid = profileData.id;

  // Step 2: Retrieve profile metadata and texture session data using UUID
  const sessionRes = await fetch(
    `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
  );
  if (!sessionRes.ok) throw new Error("Could not retrieve session data for player");
  const sessionData = await sessionRes.json();

  // Locate the specific base64 encoded textures property string
  const texturesProp = sessionData.properties?.find(
    (p: MojangProfileProperty) => p.name === "textures",
  );
  if (!texturesProp) throw new Error("No texture properties found in player profile");

  // Step 3: Decode base64 texture package into standard JSON string to extract PNG URL
  const decodedTextures = JSON.parse(atob(texturesProp.value));
  const skinUrl = decodedTextures.textures?.SKIN?.url;
  if (!skinUrl) throw new Error("Player profile does not contain a custom skin URL");

  return skinUrl;
}
