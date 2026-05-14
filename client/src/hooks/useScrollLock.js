import { useLayoutEffect } from 'react';

/**
 * Hook to lock body scroll when a modal/overlay is open.
 * Handles nested modals using a global counter.
 */
let lockCount = 0;

export const useScrollLock = (lock) => {
    useLayoutEffect(() => {
        if (!lock) return;

        lockCount++;
        
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        const body = document.body;

        if (lockCount === 1) {
            const scrollY = window.scrollY;
            
            // Save current styles to restore them later
            body.dataset.prevPosition = body.style.position;
            body.dataset.prevTop = body.style.top;
            body.dataset.prevWidth = body.style.width;
            body.dataset.prevOverflow = body.style.overflow;
            body.dataset.prevPaddingRight = body.style.paddingRight;
            body.dataset.scrollY = scrollY.toString();

            // Apply lock styles
            body.style.position = 'fixed';
            body.style.top = `-${scrollY}px`;
            body.style.width = '100%';
            body.style.overflow = 'hidden';
            body.classList.add('modal-open');
            
            if (scrollBarWidth > 0) {
                body.style.paddingRight = `${scrollBarWidth}px`;
            }
        }

        return () => {
            lockCount--;
            if (lockCount === 0) {
                const scrollY = parseInt(body.dataset.scrollY || '0');
                
                // Restore previous styles
                body.style.position = body.dataset.prevPosition || '';
                body.style.top = body.dataset.prevTop || '';
                body.style.width = body.dataset.prevWidth || '';
                body.style.overflow = body.dataset.prevOverflow || '';
                body.style.paddingRight = body.dataset.prevPaddingRight || '';
                body.classList.remove('modal-open');

                // Cleanup dataset
                delete body.dataset.prevPosition;
                delete body.dataset.prevTop;
                delete body.dataset.prevWidth;
                delete body.dataset.prevOverflow;
                delete body.dataset.prevPaddingRight;
                delete body.dataset.scrollY;

                // Restore scroll position
                window.scrollTo(0, scrollY);
            }
        };
    }, [lock]);
};
