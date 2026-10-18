import React, { useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Scissors, Receipt, Printer, Check, Info, Star } from 'lucide-react';
import { PRINT_FORMAT_OPTIONS, getFormatOption } from '../utils/printFormatConstants';
import { ToastContext } from '../context/ToastContext';
import { shopService } from '../services/api';
import { offlineDB } from '../services/offlineDB';

const ICONS = {
    full_a4: FileText,
    half_a4: Scissors,
    thermal_58: Receipt,
    thermal_80: Printer,
};

/**
 * PrintFormatSelector Component
 * 
 * @param {Object} props
 * @param {string} props.value Currently selected format ('full_a4' | 'half_a4' | 'thermal_58' | 'thermal_80')
 * @param {Function} props.onChange Callback when format changes (newFormat) => void
 * @param {string} [props.savedDefault='full_a4'] Shop's saved default format (defaults to 'full_a4')
 * @param {string} [props.shopId] Optional shop ID to automatically save default format to backend
 * @param {Function} [props.onShopUpdate] Optional callback (updatedShop) => void when shop default is saved
 * @param {Function} [props.onSetDefault] Optional custom handler (newDefaultFormat) => Promise<void>
 * @param {'cards' | 'pills' | 'select'} [props.mode='cards'] Render variant
 * @param {boolean} [props.showPrinterTip=true] Whether to show the printer driver notice
 * @param {boolean} [props.disabled=false]
 */
export const PrintFormatSelector = ({
    value = 'full_a4',
    onChange,
    savedDefault = 'full_a4',
    shopId,
    onShopUpdate,
    onSetDefault,
    mode = 'cards',
    showPrinterTip = true,
    disabled = false
}) => {
    const routeParams = useParams() || {};
    const effectiveShopId = shopId || routeParams?.shopId;
    const [isSaving, setIsSaving] = useState(false);
    const toastCtx = useContext(ToastContext);
    const showToast = toastCtx?.showToast || ((msg) => console.log(msg));

    const currentOpt = getFormatOption(value);
    const effectiveDefault = savedDefault || 'full_a4';
    const canSetDefault = Boolean(onSetDefault || effectiveShopId);

    const handleSetAsDefault = async (formatToSave) => {
        if (isSaving || disabled) return;
        setIsSaving(true);
        try {
            if (onSetDefault) {
                await onSetDefault(formatToSave);
            } else if (effectiveShopId) {
                const res = await shopService.update(effectiveShopId, { defaultPrintFormat: formatToSave });
                const updatedShop = res?.data?.data;
                if (updatedShop) {
                    if (onShopUpdate) {
                        onShopUpdate(updatedShop);
                    }
                    try {
                        await offlineDB.saveShopsBulk([updatedShop]);
                    } catch (cacheErr) {
                        console.warn('Cache save warning:', cacheErr);
                    }
                }
                const opt = getFormatOption(formatToSave);
                showToast(`Default bill format set to ${opt.name}`, 'success');
            }
        } catch (err) {
            console.error('Failed to save default print format:', err);
            showToast('Failed to save default format. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (mode === 'pills') {
        const isCurrentDefault = value === effectiveDefault;

        return (
            <div className="pfs-pills-container">
                <div className="pfs-pills-track" role="radiogroup" aria-label="Bill Print Format">
                    {PRINT_FORMAT_OPTIONS.map((opt) => {
                        const Icon = ICONS[opt.id] || FileText;
                        const isSelected = value === opt.id;
                        const isSavedDefault = effectiveDefault === opt.id;

                        return (
                            <button
                                key={opt.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                disabled={disabled}
                                className={`pfs-pill-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => onChange?.(opt.id)}
                                title={`${opt.name} (${opt.paperSize}) — ${opt.shortDesc}`}
                            >
                                <Icon size={14} className="pfs-pill-icon" />
                                <span className="pfs-pill-name">{opt.name}</span>
                                {isSavedDefault && (
                                    <span className="pfs-pill-badge-def" title="Default printing format">
                                        Default
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {canSetDefault && (
                    <div className="pfs-default-action-wrap">
                        {!isCurrentDefault ? (
                            <button
                                type="button"
                                className="pfs-set-default-btn"
                                onClick={() => handleSetAsDefault(value)}
                                disabled={isSaving || disabled}
                                title={`Set ${currentOpt.name} as default printing format for this shop`}
                            >
                                {isSaving ? (
                                    <span className="pfs-mini-spinner" />
                                ) : (
                                    <Star size={13} className="pfs-star-icon" />
                                )}
                                <span>Set as Default</span>
                            </button>
                        ) : (
                            <div className="pfs-saved-default-indicator" title="This format is saved as the retailer default">
                                <Check size={12} strokeWidth={2.5} />
                                <span>Default Format</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (mode === 'select') {
        const isCurrentDefault = value === effectiveDefault;

        return (
            <div className="pfs-select-wrap">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={disabled}
                        className="pfs-native-select"
                        style={{ flex: 1 }}
                    >
                        {PRINT_FORMAT_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>
                                {opt.name} ({opt.paperSize}) — {opt.shortDesc}
                                {effectiveDefault === opt.id ? ' [Default]' : ''}
                            </option>
                        ))}
                    </select>

                    {canSetDefault && !isCurrentDefault && (
                        <button
                            type="button"
                            className="pfs-set-default-btn"
                            onClick={() => handleSetAsDefault(value)}
                            disabled={isSaving || disabled}
                            style={{ height: '40px', whiteSpace: 'nowrap' }}
                        >
                            {isSaving ? <span className="pfs-mini-spinner" /> : <Star size={13} />}
                            <span>Set as Default</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Default: 'cards' layout for Settings / Modals
    return (
        <div className="pfs-cards-container">
            <div className="pfs-grid">
                {PRINT_FORMAT_OPTIONS.map((opt) => {
                    const Icon = ICONS[opt.id] || FileText;
                    const isSelected = value === opt.id;
                    const isSavedDefault = effectiveDefault === opt.id;

                    return (
                        <div
                            key={opt.id}
                            className={`pfs-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => !disabled && onChange?.(opt.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onChange?.(opt.id);
                                }
                            }}
                        >
                            <div className="pfs-card-header">
                                <div className={`pfs-icon-wrap ${isSelected ? 'active' : ''}`}>
                                    <Icon size={20} />
                                </div>
                                <div className="pfs-badges">
                                    <span className="pfs-badge-size">{opt.paperSize}</span>
                                    {isSavedDefault && (
                                        <span className="pfs-badge-default">Current Default</span>
                                    )}
                                </div>
                                <div className={`pfs-radio-circle ${isSelected ? 'checked' : ''}`}>
                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                            </div>

                            <div className="pfs-card-body">
                                <h4 className="pfs-title">{opt.name}</h4>
                                <p className="pfs-short-desc">{opt.shortDesc}</p>
                                <p className="pfs-full-desc">{opt.description}</p>
                            </div>

                            {canSetDefault && isSelected && !isSavedDefault && (
                                <button
                                    type="button"
                                    className="pfs-card-set-def-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetAsDefault(opt.id);
                                    }}
                                    disabled={isSaving}
                                    title={`Save ${opt.name} as default format`}
                                >
                                    {isSaving ? <span className="pfs-mini-spinner" /> : <Star size={13} />}
                                    <span>Set as Default</span>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {showPrinterTip && (
                <div className="pfs-printer-notice">
                    <Info size={16} className="pfs-notice-icon" />
                    <div className="pfs-notice-text">
                        <strong>Printer Compatibility Note:</strong>
                        <span> {currentOpt.printerTip} Browser print cannot physically configure printer hardware; verify paper size in your print driver dialog.</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrintFormatSelector;
