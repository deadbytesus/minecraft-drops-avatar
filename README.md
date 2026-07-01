# minecraft-drops-avatar

A lightweight Minecraft skin utility that fetches profiles directly from the official Mojang API and uses an algorithmic pixel matrix to render high-fidelity, chunky Drops-style avatars on native HTML5 canvas.

## Credits

The core pixel layout function used inside `avDropsRenderSkin` was taken directly from the client-side JavaScript source code of the [mc-tools.net](https://mc-tools.net) website. All rights to the original logic layout belong to them.

## Installation

```bash
npm install minecraft-drops-avatar
```

## Basic Usage

The package exports two helper loaders and the core matrix processing pipeline.

```typescript
import { loadImageFromUrl, avDropsRenderSkin } from "minecraft-drops-avatar";

// 1. Render an avatar directly from a public URL string or static public asset path
const skinImg = await loadImageFromUrl("./img.png");
const canvas = avDropsRenderSkin(skinImg, true); // true enables the overlay layers

// 2. Append generated graphic directly into your viewport DOM node
document.body.appendChild(canvas);
```

## Next.js Core Blueprint Example

Because Mojang blocks direct client-side requests via **CORS policies**, wrap the profile resolution step safely on your server layer.

### 1. The Server Proxy (`app/api/skin/[username]/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { getSkinUrlByUsername } from "minecraft-drops-avatar";

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const skinUrl = await getSkinUrlByUsername(username);
    return NextResponse.json({ url: skinUrl });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
```

### 2. The Client Component Viewport (`components/Avatar.tsx`)

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { loadImageFromUrl, avDropsRenderSkin } from "@/lib/minecraft";

async function getSkinByUsername(username: string): Promise<HTMLImageElement> {
  const res = await fetch(`/api/skin/${username}`);
  if (!res.ok) throw new Error("Could not fetch skin via internal proxy");

  const data = (await res.json()) as { url: string };

  return loadImageFromUrl(data.url);
}

interface AvatarProps {
  username?: string;
  url?: string;
}

export function Avatar({ username, url }: AvatarProps) {
  const containerCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderAvatar() {
      setError(null);
      try {
        let skinImg: HTMLImageElement | null = null;

        if (url) {
          skinImg = await loadImageFromUrl(url);
        } else if (username) {
          skinImg = await getSkinByUsername(username);
        } else {
          skinImg = await getSkinByUsername("mhf_steve");
        }

        if (!isMounted || !skinImg) return;

        const generatedCanvas = avDropsRenderSkin(skinImg, true);

        const targetCanvas = containerCanvasRef.current;
        if (targetCanvas) {
          targetCanvas.width = generatedCanvas.width;
          targetCanvas.height = generatedCanvas.height;
          const ctx = targetCanvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(generatedCanvas, 0, 0);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.error(err);
        setError("Failed to render avatar");
      }
    }

    renderAvatar();

    return () => {
      isMounted = false;
    };
  }, [username, url]);

  if (error) {
    return <div style={{ color: "red", fontSize: "14px" }}>{error}</div>;
  }

  return (
    <canvas
      ref={containerCanvasRef}
      style={{
        width: "112px",
        height: "128px",
        imageRendering: "pixelated",
      }}
    />
  );
}
```
