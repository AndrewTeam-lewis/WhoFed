export function swipe(node: HTMLElement, { threshold = 100 } = {}) {
    let startX: number;
    let startY: number;

    function handlePointerDown(event: PointerEvent) {
        startX = event.clientX;
        startY = event.clientY;

        node.dispatchEvent(new CustomEvent('panstart', {
            detail: { x: startX, y: startY }
        }));

        // Essential for tracking outside the element
        node.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
        if (event.buttons === 0) return; // Only if pressed

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        // If mostly horizontal
        if (Math.abs(dx) > Math.abs(dy)) {
            // Prevent scrolling on supported devices (though touch-action usually handles this)
            event.preventDefault();

            node.dispatchEvent(new CustomEvent('panmove', {
                detail: { dx, dy }
            }));
        }
    }

    function handlePointerUp(event: PointerEvent) {
        const dx = event.clientX - startX;

        node.dispatchEvent(new CustomEvent('panend', {
            detail: { dx }
        }));

        if (Math.abs(dx) > threshold) {
            node.dispatchEvent(new CustomEvent('swipe', {
                detail: { direction: dx > 0 ? 'right' : 'left' }
            }));
        }

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
