/** Mobile tree gestures: two-finger pan (avoid Android back / PTR) and portrait fit. */

export type TreeDim = {
  width: number;
  height: number;
  x_off: number;
  y_off: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type FitView = {
  k: number;
  x: number;
  y: number;
  mode: "contain" | "width";
};

const WIDE_TREE_RATIO = 1.12;

export function prefersTwoFingerPan(
  matches: (query: string) => boolean = (query) =>
    typeof window !== "undefined" && window.matchMedia(query).matches,
): boolean {
  return matches("(pointer: coarse)");
}

export function chartZoomFilter(
  event: { type: string; touches?: ArrayLike<unknown>; button?: number },
  twoFinger: boolean,
): boolean {
  if (event.type !== "wheel" && event.button) return false;
  if (!twoFinger) return true;
  if (
    event.type === "wheel" ||
    event.type === "mousedown" ||
    event.type === "dblclick"
  ) {
    return true;
  }
  if (event.touches) return event.touches.length >= 2;
  return true;
}

export function isPortraitWideTree(view: ViewportSize, dim: TreeDim): boolean {
  if (!(view.height > view.width)) return false;
  return dim.width / Math.max(dim.height, 1) > WIDE_TREE_RATIO;
}

/** Average Y of branch headers, else the first descendant generation. */
export function overviewFocusY(
  labelYs: number[],
  generationYs: number[] = [],
): number | undefined {
  if (labelYs.length) {
    return labelYs.reduce((sum, y) => sum + y, 0) / labelYs.length;
  }
  return generationYs[0];
}

/**
 * Desktop / landscape: letterbox the whole tree.
 * Portrait + horizontal graph: fill the width and pin Y on the labeled generation
 * (or the top of the strip) so the thin band is not lost in the middle of the screen.
 */
export function fitTreeView(
  view: ViewportSize,
  dim: TreeDim,
  focusY?: number,
): FitView {
  const portraitWide = isPortraitWideTree(view, dim);
  const padX = portraitWide ? 10 : 24;
  const padY = 24;
  const kWidth = (view.width - padX * 2) / dim.width;
  const kHeight = (view.height - padY * 2) / dim.height;

  if (portraitWide) {
    const k = Math.min(kWidth, 1);
    const x = k * dim.x_off + (view.width - dim.width * k) / 2;
    if (typeof focusY === "number") {
      return {
        k,
        x,
        y: view.height * 0.3 - focusY * k,
        mode: "width",
      };
    }
    return {
      k,
      x,
      y: k * dim.y_off + Math.min(28, view.height * 0.08),
      mode: "width",
    };
  }

  const k = Math.min(kWidth, kHeight, 1);
  return {
    k,
    x: k * dim.x_off + (view.width - dim.width * k) / 2,
    y: k * dim.y_off + (view.height - dim.height * k) / 2,
    mode: "contain",
  };
}
