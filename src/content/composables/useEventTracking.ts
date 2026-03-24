import { contentState, setRecordingState } from './useContentState';
import { useElementSelector } from './useElementSelector';

// PII Detection helper
function detectPII(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const el = element;
    const tag = (el.tagName || '').toLowerCase();

    // Already masked by input type
    if (el.type === 'password') return { masked: true, label: 'Password' };

    // Gather all identifying attributes into one lowercased string for quick scanning
    const attrs = [
        el.type || '',
        el.name || '',
        el.id || '',
        el.getAttribute('autocomplete') || '',
        el.getAttribute('placeholder') || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('data-field') || '',
        el.getAttribute('data-type') || '',
        (el.className || '').replace(/\s+/g, ' ')
    ].join(' ').toLowerCase();

    // --- Attribute-based detection (highest confidence) ---
    const attrRules = [
        { patterns: ['card-number', 'cardnumber', 'cc-number', 'ccnumber', 'credit-card', 'creditcard', 'card number'], label: 'Credit Card Number' },
        { patterns: ['card-cvc', 'cvc', 'cvv', 'card-cvv', 'security-code', 'securitycode'], label: 'Card CVV/CVC' },
        { patterns: ['card-expiry', 'cardexpiry', 'cc-exp', 'expiry', 'expiration', 'card-exp'], label: 'Card Expiry' },
        { patterns: ['card-name', 'cardholder', 'card holder', 'name-on-card'], label: 'Cardholder Name' },
        { patterns: ['ssn', 'social-security', 'tax-id', 'taxid', 'national-id'], label: 'SSN / Tax ID' },
        { patterns: ['passport'], label: 'Passport Number' },
        { patterns: ['driver-license', 'drivers-license', 'license-number'], label: 'Driver\'s License' },
        { patterns: ['email', 'e-mail', 'mail'], label: 'Email Address' },
        { patterns: ['phone', 'tel', 'mobile', 'cell', 'phonenumber', 'phone-number'], label: 'Phone Number' },
        { patterns: ['first-name', 'firstname', 'last-name', 'lastname', 'full-name', 'fullname', 'given-name', 'family-name', 'surname'], label: 'Full Name' },
        { patterns: ['dob', 'date-of-birth', 'dateofbirth', 'birthday', 'birth-date', 'birthdate'], label: 'Date of Birth' },
        { patterns: ['address', 'street', 'addr-line', 'address-line', 'delivery-address', 'billing-address', 'shipping-address'], label: 'Address' },
        { patterns: ['postcode', 'post-code', 'postal', 'zipcode', 'zip-code', 'zip'], label: 'Postal / ZIP Code' },
        { patterns: ['city', 'town', 'locality'], label: 'City' },
        { patterns: ['country', 'nation'], label: 'Country' },
        { patterns: ['iban', 'bank-account', 'account-number', 'routing-number', 'sort-code'], label: 'Bank Account / IBAN' },
    ];

    for (const rule of attrRules) {
        if (rule.patterns.some(p => attrs.includes(p))) {
            return { masked: true, label: rule.label };
        }
    }

    const val = value.trim();
    if (!val) return { masked: false };

    if (/^[2-6]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(val.replace(/\s/g, ''))) {
        return { masked: true, label: 'Credit Card Number' };
    }
    if (/^\d{3,4}$/.test(val) && attrs.match(/cc|card|payment/)) {
        return { masked: true, label: 'Card CVV/CVC' };
    }
    if (/^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(val)) {
        return { masked: true, label: 'Email Address' };
    }
    if (/^(\+?[\d\s\-().]{7,15})$/.test(val) && /\d{7,}/.test(val.replace(/\D/g, ''))) {
        return { masked: true, label: 'Phone Number' };
    }
    if (/^\d{3}-\d{2}-\d{4}$/.test(val)) {
        return { masked: true, label: 'SSN' };
    }
    if (/^[A-Z]{2}\d{2}[\dA-Z]{11,30}$/.test(val.replace(/\s/g, ''))) {
        return { masked: true, label: 'IBAN' };
    }

    return { masked: false };
}

export function useEventTracking(clickColor: string = '#fa383e', clickSize: number = 30) {
    const selectorUtils = useElementSelector();

    let inputTimer: any = null;
    let pendingInput: any = null;

    const flushInput = () => {
        if (inputTimer) {
            clearTimeout(inputTimer);
            inputTimer = null;
        }
        if (pendingInput) {
            chrome.runtime.sendMessage({
                action: "recordUserEvent",
                event: pendingInput
            });
            pendingInput = null;
        }
    };

    const isExtensionUI = (target: Node | null): boolean => {
        if (!target || target === document || target === document.body) return false;
        let el = target as Element | null;
        while (el) {
            if (el.id === 'signal-root') return true;
            if (el.tagName && el.tagName.toLowerCase() === 'signal-replay-widget') return true;
            el = el.parentElement || el.parentNode as Element;
            if ((el as unknown) === document || el === document.documentElement) break;
        }
        return false;
    };

    const onInput = (e: Event) => {
        if (isExtensionUI(e.target as Node)) return;
        if (contentState.isPaused || !contentState.isRecording) return;

        if (inputTimer) clearTimeout(inputTimer);

        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        const rawValue = target.value ? target.value.substring(0, 500) : '';
        const pii = detectPII(target, rawValue);
        const recordedValue = pii.masked ? '[REDACTED: ' + pii.label + ']' : rawValue;

        const safeClassName = (typeof target.className === 'string')
            ? target.className
            // @ts-ignore
            : ((target.className && target.className.baseVal) || '');

        pendingInput = {
            type: 'input',
            timestamp: Date.now(),
            target: {
                ...selectorUtils.getElementBundle(target)
            },
            value: recordedValue,
            piiMasked: pii.masked
        };
    };

    const onClick = (e: MouseEvent) => {
        flushInput();
        if (isExtensionUI(e.target as Node)) return;
        if (contentState.isPaused || !contentState.isRecording) return;

        // Visual Ripple Effect
        const size = clickSize;
        const half = size / 2;
        const color = clickColor || '#fa383e'; // Fallback

        const ripple = document.createElement('div');
        ripple.style.cssText = `
        position: fixed;
        left: ${e.clientX - half}px;
        top: ${e.clientY - half}px;
        width: ${size}px;
        height: ${size}px;
        background-color: ${color} !important;
        opacity: 0.6;
        border-radius: 50%;
        pointer-events: none;
        z-index: 2147483647;
        transition: transform 0.4s ease-out, opacity 0.4s ease-out;
        `;
        document.body.appendChild(ripple);

        requestAnimationFrame(() => {
            ripple.style.transform = 'scale(1.5)';
            ripple.style.opacity = '0';
            setTimeout(() => ripple.remove(), 400);
        });

        const standardClickable = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA']);
        let resolvedTarget = e.target as Element;
        let walkEl = e.target as Element | null;
        while (walkEl && walkEl !== document.body && walkEl !== document.documentElement) {
            if (standardClickable.has(walkEl.tagName)) {
                resolvedTarget = walkEl;
                break;
            }
            walkEl = walkEl.parentElement;
        }

        const safeClassName = (typeof resolvedTarget.className === 'string')
            ? resolvedTarget.className
            // @ts-ignore
            : (resolvedTarget.className && resolvedTarget.className.baseVal) || '';

        chrome.runtime.sendMessage({
            action: "recordUserEvent",
            event: {
                type: 'click',
                timestamp: Date.now(),
                target: {
                    innerText: (resolvedTarget as HTMLElement).innerText ? (resolvedTarget as HTMLElement).innerText.substring(0, 50) : '',
                    ...selectorUtils.getElementBundle(resolvedTarget)
                },
                x: e.clientX,
                y: e.clientY
            }
        });
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (isExtensionUI(e.target as Node)) return;
        if (contentState.isPaused || !contentState.isRecording) return;

        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if (isInput) {
            if (e.key === 'Enter') {
                flushInput();
                const form = target.closest('form');
                if (form) {
                    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])') || form;
                    const safeClassName = (typeof submitBtn.className === 'string')
                        ? submitBtn.className
                        // @ts-ignore
                        : (submitBtn.className && submitBtn.className.baseVal) || '';
                    chrome.runtime.sendMessage({
                        action: "recordUserEvent",
                        event: {
                            type: 'click',
                            timestamp: Date.now(),
                            target: {
                                innerText: (submitBtn as HTMLElement).innerText ? (submitBtn as HTMLElement).innerText.substring(0, 50) : '',
                                ...selectorUtils.getElementBundle(submitBtn)
                            },
                            triggeredBy: 'enter-submit'
                        }
                    });
                }
            } else if (e.key === 'Tab' || e.key === 'Escape') {
                flushInput();
                chrome.runtime.sendMessage({
                    action: "recordUserEvent",
                    event: {
                        type: 'keydown',
                        timestamp: Date.now(),
                        key: e.key,
                        code: e.code,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey
                    }
                });
            }
        } else {
            const meaningfulKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
            const isShortcut = e.ctrlKey || e.metaKey || e.altKey;
            if (meaningfulKeys.includes(e.key) || isShortcut) {
                chrome.runtime.sendMessage({
                    action: "recordUserEvent",
                    event: {
                        type: 'keydown',
                        timestamp: Date.now(),
                        key: e.key,
                        code: e.code,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey
                    }
                });
            }
        }
    };

    const onSubmit = (e: Event) => {
        if (isExtensionUI(e.target as Node)) return;
        if (contentState.isPaused || !contentState.isRecording) return;
        flushInput();
    };

    const initEventTracking = () => {
        document.addEventListener('input', onInput, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('submit', onSubmit, true);

        document.addEventListener('blur', flushInput, true);
        document.addEventListener('focusout', flushInput, true);
        window.addEventListener('beforeunload', flushInput);
    };

    const detachEventTracking = () => {
        document.removeEventListener('input', onInput, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('submit', onSubmit, true);

        document.removeEventListener('blur', flushInput, true);
        document.removeEventListener('focusout', flushInput, true);
        window.removeEventListener('beforeunload', flushInput);
    };

    return {
        initEventTracking,
        detachEventTracking
    };
}
