import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';

const API_URL = '/api';

/**
 * Professional Invoice Service
 */
export const invoiceService = {
    /**
     * Generate a Premium PDF Invoice
     */
    generateInvoicePDF: (data, shop, type = 'SALE') => {
        const doc = new jsPDF();
        const primaryColor = [7, 27, 68]; // Deep Business Navy
        const accentColor = [30, 107, 255]; // Premium Blue
        const textColor = [30, 41, 59];
        const slateColor = [100, 116, 139];
        
        // --- Header Section (Centered) ---
        // Top accent line
        doc.setFillColor(...accentColor);
        doc.rect(0, 0, 210, 3, 'F');

        // Shop Name
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...primaryColor);
        const shopName = (shop?.name || 'ShopPulse Business').toUpperCase();
        const wrappedName = doc.splitTextToSize(shopName, 170);
        doc.text(wrappedName, 105, 25, { align: 'center' });
        
        let currentY = 25 + (wrappedName.length * 8);

        // Shop Details
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...slateColor);
        const address = shop?.location || 'India';
        const wrappedAddress = doc.splitTextToSize(address, 160);
        doc.text(wrappedAddress, 105, currentY, { align: 'center' });
        
        currentY += (wrappedAddress.length * 5);
        doc.text(`Phone: ${shop?.contactNumber || 'XXXXXXXXXX'} | GSTIN: ${shop?.gstNumber || 'N/A'}`, 105, currentY, { align: 'center' });
        
        currentY += 12;
        doc.setDrawColor(226, 232, 240);
        doc.line(20, currentY, 190, currentY);
        currentY += 10;

        // --- Info Grid ---
        // Left Side: Invoice Details
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...slateColor);
        doc.text("INVOICE DETAILS", 20, currentY);
        
        doc.setFontSize(10);
        doc.setTextColor(...textColor);
        currentY += 7;
        const billLabel = type === 'PURCHASE' ? 'Bill No' : 'Invoice No';
        doc.text(`${billLabel}:`, 20, currentY);
        doc.setFont("helvetica", "bold");
        doc.text(`#${data._id.slice(-6).toUpperCase()}`, 50, currentY);
        
        doc.setFont("helvetica", "normal");
        currentY += 6;
        doc.text("Date:", 20, currentY);
        doc.text(new Date(data.date).toLocaleDateString('en-IN'), 50, currentY);
        
        currentY += 6;
        doc.text("Payment:", 20, currentY);
        doc.setFont("helvetica", "bold");
        doc.text(data.paymentMethod.toUpperCase(), 50, currentY);

        // Right Side: Customer Details
        let rightColY = currentY - 19;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...slateColor);
        const partyLabel = type === 'PURCHASE' ? 'SUPPLIER DETAILS' : 'CUSTOMER DETAILS';
        doc.text(partyLabel, 120, rightColY);
        
        doc.setFontSize(10);
        doc.setTextColor(...textColor);
        rightColY += 7;
        const partyName = type === 'PURCHASE' ? data.supplierName : (data.customerName || 'Walk-in Customer');
        doc.setFont("helvetica", "bold");
        doc.text(partyName, 120, rightColY);
        
        doc.setFont("helvetica", "normal");
        rightColY += 6;
        const partyPhone = type === 'PURCHASE' ? data.supplierPhone : (data.customerMobile || data.customerPhone);
        if (partyPhone) {
            doc.text(`Mobile: ${partyPhone}`, 120, rightColY);
        }

        currentY += 10;

        // --- Items Table ---
        const tableColumn = ["Sl", "Product Description", "Qty", "Rate", "Amount"];
        const tableRows = [];

        (data.items || []).forEach((item, index) => {
            const qty = item.soldQtyEntered || item.quantity || 0;
            const unit = item.soldUnit || item.unit || 'Pc';
            const rate = item.pricePerBaseUnit || item.purchaseRate || item.price || 0;
            const amount = item.itemTotal || item.totalPrice || (qty * rate);
            
            tableRows.push([
                index + 1,
                item.productName,
                `${qty} ${unit}`,
                `Rs. ${rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ]);
        });

        autoTable(doc, { 
            head: [tableColumn],
            body: tableRows,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'left' },
                2: { halign: 'center', cellWidth: 25 },
                3: { halign: 'right', cellWidth: 35 },
                4: { halign: 'right', cellWidth: 35 }
            },
            bodyStyles: { fontSize: 9, textColor: [...textColor] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 20, right: 20 }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
        
        // --- Summary & Totals ---
        const summaryX = 130;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...slateColor);
        
        doc.text(`Subtotal:`, summaryX, currentY);
        doc.setTextColor(...textColor);
        const grandTotal = data.totalAmount || data.totalPrice || 0;
        doc.text(`Rs. ${(grandTotal + (data.discount || 0)).toLocaleString()}`, 190, currentY, { align: 'right' });
        
        if (data.discount > 0) {
            currentY += 7;
            doc.setTextColor(...slateColor);
            doc.text(`Discount:`, summaryX, currentY);
            doc.setTextColor(22, 163, 74);
            doc.text(`- Rs. ${data.discount.toLocaleString()}`, 190, currentY, { align: 'right' });
        }
        
        currentY += 10;
        doc.setFillColor(...primaryColor);
        doc.rect(125, currentY - 6, 65, 10, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(`GRAND TOTAL:`, 130, currentY);
        doc.text(`Rs. ${grandTotal.toLocaleString()}`, 185, currentY, { align: 'right' });
        
        // --- Footer ---
        currentY = 270; // Position at bottom of A4
        doc.setDrawColor(226, 232, 240);
        doc.line(20, currentY - 15, 190, currentY - 15);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...primaryColor);
        doc.text("Thank you for your business!", 105, currentY - 5, { align: 'center' });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...slateColor);
        doc.text("Returns accepted within 7 days with original bill. Computer generated invoice.", 105, currentY, { align: 'center' });
        doc.text("Generated by ShopPulse POS", 105, currentY + 5, { align: 'center' });

        return doc;
    },

    /**
     * Share Invoice via WhatsApp (PDF or Link)
     */
    shareInvoice: async (data, shop, type = 'SALE') => {
        try {
            const doc = invoiceService.generateInvoicePDF(data, shop, type);
            const fileName = `Invoice-${data._id.slice(-6).toUpperCase()}.pdf`;
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // 1. Try Web Share API (Mobile native sharing)
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    title: `Invoice from ${shop?.name || 'ShopPulse'}`,
                    text: `Please find the invoice for Bill #${data._id.slice(-6).toUpperCase()}`
                });
                return { success: true, method: 'native' };
            }

            // 2. Fallback: Upload and share link (Desktop/Older browsers)
            // Convert to Base64 for upload
            const reader = new FileReader();
            const pdfBase64 = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(pdfBlob);
            });

            const uploadRes = await axios.post(`${API_URL}/invoices/upload`, {
                pdfBase64,
                filename: fileName
            });

            if (uploadRes.data.success) {
                const publicUrl = uploadRes.data.url;
                const waText = encodeURIComponent(
                    `*${shop?.name || 'ShopPulse Business'}*%0A` +
                    `Invoice for Bill #${data._id.slice(-6).toUpperCase()}%0A` +
                    `Amount: ₹${data.totalAmount.toLocaleString()}%0A%0A` +
                    `View Invoice PDF: ${publicUrl}%0A%0A` +
                    `Generated by ShopPulse.`
                );
                window.open(`https://wa.me/?text=${waText}`, '_blank');
                return { success: true, method: 'link' };
            }

            throw new Error('Upload failed');
        } catch (err) {
            console.error('Sharing failed:', err);
            // 3. Fallback-Fallback: Plain text sharing
            const waText = encodeURIComponent(
                `*${shop?.name || 'ShopPulse Business'}*%0A` +
                `Invoice for Bill #${data._id.slice(-6).toUpperCase()}%0A` +
                `Amount: ₹${data.totalAmount.toLocaleString()}%0A%0A` +
                `Thank you for your business!`
            );
            window.open(`https://wa.me/?text=${waText}`, '_blank');
            return { success: false, method: 'text' };
        }
    },

    /**
     * Download Invoice PDF
     */
    downloadInvoice: (data, shop, type = 'SALE') => {
        const doc = invoiceService.generateInvoicePDF(data, shop, type);
        const fileName = `Invoice-${data._id.slice(-6).toUpperCase()}.pdf`;
        doc.save(fileName);
    }
};
