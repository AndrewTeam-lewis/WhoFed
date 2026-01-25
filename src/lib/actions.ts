export function swipe(node: HTMLElement, { threshold = 100 } = {}) {
    let startX: number;
    let startY: number;

    function handlePointerDown(event: PointerEvent) {
        startX = event.clientX;
        startY = event.clientY;
        // Reset lock state
        (node as any)._swipeAxis = null; // 'x' or 'y'

        node.dispatchEvent(new CustomEvent('panstart', {
            detail: { x: startX, y: startY }
        }));

        node.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
        if (event.buttons === 0) return;

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        // Determine axis if not yet locked
        if (!(node as any)._swipeAxis) {
            // Must move at least a tiny bit to decide
            if (absX > 5 || absY > 5) {
                if (absX > absY) {
                    (node as any)._swipeAxis = 'x';
                } else {
                    (node as any)._swipeAxis = 'y';
                }
            }
        }

        // Only fire if we are locked to X axis
        if ((node as any)._swipeAxis === 'x') {
            node.dispatchEvent(new CustomEvent('panmove', {
                detail: { dx, dy }
            }));
        }
        // If 'y', we silently ignore (let browser scroll)
    }

    function handlePointerUp(event: PointerEvent) {
        const dx = event.clientX - startX;

        // Only dispatch end/swipe if we were actually swiping X
        if ((node as any)._swipeAxis === 'x') {
            node.dispatchEvent(new CustomEvent('panend', {
                detail: { dx }
            }));

            if (Math.abs(dx) > threshold) {
                node.dispatchEvent(new CustomEvent('swipe', {
                    detail: { direction: dx > 0 ? 'right' : 'left' }
                }));
            }
        }

        (node as any)._swipeAxis = null;
        node.releasePointerCapture(event.pointerId);
    }

    node.addEventListener('pointerdown', handlePointerDown);
    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerup', handlePointerUp);
    // Handle cancel too
    node.addEventListener('pointercancel', handlePointerUp);

    return {
        destroy() {
            node.removeEventListener('pointerdown', handlePointerDown);
            node.removeEventListener('pointermove', handlePointerMove);
            node.removeEventListener('pointerup', handlePointerUp);
            node.removeEventListener('pointercancel', handlePointerUp);
        }
    };
}
