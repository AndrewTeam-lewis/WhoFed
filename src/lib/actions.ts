export function swipe(node: HTMLElement, { threshold = 50 } = {}) {
    let startX: number;
    let startY: number;

    function handleTouchStart(event: TouchEvent) {
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
    }

    function handleTouchEnd(event: TouchEvent) {
        const touch = event.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;

        const deltaX = endX - startX;
        const deltaY = endY - startY;

        // Ensure purely horizontal swipe (more horizontal than vertical)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
            node.dispatchEvent(new CustomEvent('swipe', {
                detail: { direction: deltaX > 0 ? 'right' : 'left' }
            }));
        }
    }

    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });

    return {
        destroy() {
            node.removeEventListener('touchstart', handleTouchStart);
            node.removeEventListener('touchend', handleTouchEnd);
        }
    };
}
