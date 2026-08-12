import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, serverTimestamp, doc, getDocs, documentId, where, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Search, Plus, FileText, X, Truck, MapPin, Package, Save, Hash, Camera, Share2, Printer, IndianRupee, Users, CheckSquare, Square, FileSpreadsheet, Download } from 'lucide-react';
import { normalizeItemName } from './utils/normalization';
import { subscribeToJavak } from './components/Dashboard';

// Formats a Date (or Firestore Timestamp-like object with toDate()) as
// dd-mm HH:MM, the required display format for Gross/Tare weight capture
// timestamps everywhere they appear (form, dispatch log, printed slip,
// Excel export).
const formatWeightTimestamp = (value) => {
    if (!value) return '';
    const d = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MIN = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm} ${HH}:${MIN}`;
};

function Javak({ currentUser, onBardanaStockUpdate, onInventoryUpdate }) {
    const [currentEntryId, setCurrentEntryId] = useState(null);
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    const [gatePassNo, setGatePassNo] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [commodity, setCommodity] = useState('BALES');
    const [customCommodity, setCustomCommodity] = useState('');
    const [numberOfBags, setNumberOfBags] = useState('');
    const [bardana, setBardana] = useState('');
    const [sutli, setSutli] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [netWt, setNetWt] = useState('');
    const [hamalName, setHamalName] = useState('');
    // eslint-disable-next-line no-unused-vars
    const [hamalId, setHamalId] = useState('');

    // Weight Timestamp Capture: the exact moment Gross Wt / Tare Wt was
    // first entered on this form. Captured once (on the empty -> non-empty
    // transition), not re-stamped on every keystroke of an already-entered
    // value, and cleared if the field is cleared back to empty.
    const [grossWtTimestamp, setGrossWtTimestamp] = useState(null);
    const [tareWtTimestamp, setTareWtTimestamp] = useState(null);

    const [isAdvancePayment, setIsAdvancePayment] = useState(false);
    const [advanceAmount, setAdvanceAmount] = useState('');

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [driverPhoto, setDriverPhoto] = useState(null);
    const [videoStream, setVideoStream] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [printEntry, setPrintEntry] = useState(null);

    const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
    const [bulkSearchQuery, setBulkSearchQuery] = useState('');
    const [selectedBulkIds, setSelectedBulkIds] = useState(new Set());
    const [bulkPrintEntries, setBulkPrintEntries] = useState(null);

    const commodityOptions = ['BALES', 'COTTON SEED', 'KAPAS'];

    // Bardana & Sutli (packing material) only apply to loose/raw commodities.
    // Cotton Bales are pre-packed, so those two fields are irrelevant for
    // that commodity — hidden from the form and cleared out whenever BALES
    // is selected, so a stale value never gets silently saved.
    const isBardanaSutliApplicable = commodity !== 'BALES';

    // Inline validation errors for the Bardana/Sutli guardrail, keyed by
    // field name ('bardana' | 'sutli'). Populated only on submit attempts
    // that fail the No. of Bags <= Bardana <= Sutli check for non-cotton
    // commodities; cleared as soon as the person edits any of the three
    // numbers so a fixed value doesn't keep showing a stale error.
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        if (Object.keys(fieldErrors).length > 0) {
            setFieldErrors({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numberOfBags, bardana, sutli, commodity]);

    // Strict vehicle plate format: 2 letters - 2 digits - 1 to 3 letters - 1 to 4 digits
    const VEHICLE_NO_REGEX = /^[A-Z]{2}-[0-9]{2}-[A-Z]{1,3}-[0-9]{1,4}$/;
    const isValidVehicleNo = (val) => VEHICLE_NO_REGEX.test(val || '');

    // Strict 10-digit phone number format, applies to Driver Phone input below.
    const PHONE_REGEX = /^[0-9]{10}$/;
    const isValidPhone = (val) => PHONE_REGEX.test(val || '');

    // Final-amount rounding helper: every monetary value that gets persisted,
    // stored, rendered on screen, or printed on an invoice/PDF must be a
    // whole rupee amount. Applied consistently everywhere a final amount is
    // produced or displayed. (Javak's only hand-typed final amount is the
    // Advance Amount given to the driver.)
    const roundAmt = (val) => Math.round(parseFloat(val) || 0);

    const handleCommodityChange = (val) => {
        setCommodity(val);
        if (val === 'BALES') {
            // Cotton Bales never uses Bardana/Sutli — clear any previously
            // entered values so they can't be silently carried into the save.
            setBardana('');
            setSutli('');
        }
    };

    // Weight Timestamp Capture handlers: stamp the moment a weight value
    // transitions from empty to non-empty; clear the stamp if the field is
    // cleared back to empty so a stale time never lingers on a blank field.
    const handleGrossWtChange = (val) => {
        if (val && !grossWt) {
            setGrossWtTimestamp(new Date());
        } else if (!val) {
            setGrossWtTimestamp(null);
        }
        setGrossWt(val);
    };

    const handleTareWtChange = (val) => {
        if (val && !tareWt) {
            setTareWtTimestamp(new Date());
        } else if (!val) {
            setTareWtTimestamp(null);
        }
        setTareWt(val);
    };

    useEffect(() => {
        const unsubscribe = subscribeToJavak((list) => {
            setEntries(list);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const lowerSearch = searchQuery.trim().toLowerCase();
        if (!lowerSearch) {
            setFilteredEntries(entries);
            return;
        }

        const filtered = entries.filter(e =>
            (e.Name && e.Name.toLowerCase().includes(lowerSearch)) ||
            (e.Village && e.Village.toLowerCase().includes(lowerSearch)) ||
            (e.tokenNo && e.tokenNo.toLowerCase().includes(lowerSearch)) ||
            (e.vehicleNo && e.vehicleNo.toLowerCase().includes(lowerSearch)) ||
            (e.gatePassNo && e.gatePassNo.toLowerCase().includes(lowerSearch)) ||
            (e.vehicleNumber && e.vehicleNumber.toLowerCase().includes(lowerSearch)) ||
            (e.destination && e.destination.toLowerCase().includes(lowerSearch)) ||
            (e.commodity && e.commodity.toLowerCase().includes(lowerSearch)) ||
            (e.driverName && e.driverName.toLowerCase().includes(lowerSearch)) ||
            (e.hamalName && e.hamalName.toLowerCase().includes(lowerSearch))
        );
        setFilteredEntries(filtered);
    }, [searchQuery, entries]);

    const parsedGross = parseFloat(grossWt || 0);
    const parsedTare = parseFloat(tareWt || 0);

    useEffect(() => {
        if (parsedGross > 0 && parsedTare > 0) {
            const calculatedNet = Math.max(0, parsedGross - parsedTare);
            setNetWt(calculatedNet);
        } else {
            setNetWt('');
        }
    }, [parsedGross, parsedTare]);

    const startCamera = async () => {
        setIsCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setVideoStream(stream);
            const videoElement = document.getElementById('camera-preview');
            if (videoElement) {
                videoElement.srcObject = stream;
            }
        } catch (error) {
            console.error("Error accessing camera: ", error);
            setStatusMessage({ text: 'Unable to access camera. Please check permissions.', type: 'error' });
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            setVideoStream(null);
        }
        setIsCameraActive(false);
    };

    // Auto-routes any Bardana/Sutli quantity on this Javak entry straight
    // into the Bardana panel's own pipeline: same 'bardana' collection,
    // same field schema (itemName, quantity, personName, employeeName,
    // type, entryMaker, timestamp) and the same DATE-SERIAL doc ID scheme
    // Bardana.js's own form uses — so these OUT movements interleave
    // correctly in "Recent Transactions" and count toward "Current Bardana
    // Stock" instead of living in a separate, invisible ID namespace.
    // Previously saved entries route lacked a `timestamp` field, which
    // Bardana.js's orderBy('timestamp') query silently excludes — so this
    // also fixes those movements never showing up in the Bardana panel.
    const syncBardanaStockOut = async (entryId, payload) => {
        // Clear out anything previously routed from this Javak entry first,
        // so edits/re-saves never leave duplicate or stale stock movements
        // behind in the shared Bardana pipeline.
        try {
            const existingQuery = query(
                collection(db, 'bardana'),
                where('source', '==', 'JAVAK'),
                where('sourceEntryId', '==', entryId)
            );
            const existingSnap = await getDocs(existingQuery);
            await Promise.all(existingSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
        } catch (err) {
            console.error('Error clearing previous Javak Bardana sync entries:', err);
        }

        const stockRows = [
            { itemName: 'BARDANA', quantity: payload.bardana },
            { itemName: 'SUTLI', quantity: payload.sutli }
        ];

        for (const row of stockRows) {
            const quantity = parseInt(row.quantity, 10) || 0;
            if (quantity <= 0) continue;

            // Mirrors Bardana.js's own ID generator: count today's existing
            // docs (by ID range, since Firestore has no native date-prefix
            // query) and take the next serial for the day.
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const startId = `${dateStr}-00`;
            const endId = `${dateStr}-99`;
            const dateQuery = query(
                collection(db, 'bardana'),
                where(documentId(), '>=', startId),
                where(documentId(), '<=', endId)
            );
            const dateSnap = await getDocs(dateQuery);
            const nextSrNo = dateSnap.size + 1;
            const docId = `${dateStr}-${String(nextSrNo).padStart(2, '0')}`;

            await setDoc(doc(db, 'bardana', docId), {
                itemName: row.itemName,
                quantity,
                personName: payload.driverName || payload.destination || 'JAVAK DISPATCH',
                employeeName: currentUser?.name || 'Staff',
                type: 'OUT',
                entryMaker: currentUser?.name || 'Unknown',
                source: 'JAVAK',
                sourceEntryId: entryId,
                timestamp: serverTimestamp()
            });
        }

        const stockPayload = {
            source: 'JAVAK',
            sourceEntryId: entryId,
            bardana: parseFloat(payload.bardana || 0),
            sutli: parseFloat(payload.sutli || 0),
            type: 'OUT'
        };

        if (typeof onBardanaStockUpdate === 'function') {
            onBardanaStockUpdate(stockPayload);
        }

        if (typeof onInventoryUpdate === 'function') {
            onInventoryUpdate(stockPayload);
        }
    };

    // Syncs the Advance Payment (if given) to the Cash Management ledger.
    // Uses a deterministic doc id tied to this Javak entry so edits update the
    // same cash record instead of creating duplicates, and removes it if the
    // advance is unchecked or set back to 0.
    const syncAdvancePaymentOut = async (entryId, payload) => {
        const cashDocRef = doc(db, 'cashTransactions', `javak_adv_${entryId}`);
        const amount = roundAmt(payload.advanceAmount || 0);

        if (payload.isAdvancePayment && amount > 0) {
            const now = new Date();
            await setDoc(cashDocRef, {
                type: 'OUT',
                personName: payload.driverName || 'DRIVER',
                employeeName: currentUser?.name || 'Staff',
                reason: `Advance Payment for ${payload.vehicleNumber || 'Vehicle'}`,
                amount,
                source: 'JAVAK',
                sourceEntryId: entryId,
                date: now.toLocaleDateString('en-CA'),
                time: now.toLocaleTimeString(),
                timestamp: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } else {
            await deleteDoc(cashDocRef).catch(() => {});
        }
    };

    const capturePhoto = () => {
        const videoElement = document.getElementById('camera-preview');
        const canvasElement = document.createElement('canvas');
        if (videoElement) {
            canvasElement.width = videoElement.videoWidth || 320;
            canvasElement.height = videoElement.videoHeight || 240;
            const ctx = canvasElement.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            const photoUrl = canvasElement.toDataURL('image/jpeg');
            setDriverPhoto(photoUrl);
            stopCamera();
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (!isValidVehicleNo(vehicleNumber)) {
            setStatusMessage({ text: 'Invalid Vehicle No. format. Use e.g. MH-26-AB-9000', type: 'error' });
            return;
        }

        if (driverPhone && !isValidPhone(driverPhone)) {
            setStatusMessage({ text: 'Driver Phone must be exactly 10 digits', type: 'error' });
            return;
        }

        if (!hamalName.trim()) {
            setStatusMessage({ text: 'Hamal Name is required', type: 'error' });
            return;
        }

        // Submission Validation Guardrail (non-cotton items only): the chain
        // No. of Bales/Bags <= Bardana <= Sutli must hold strictly. Cotton
        // Bales never uses Bardana/Sutli, so this check is skipped for it.
        if (isBardanaSutliApplicable) {
            const bagsNum = parseFloat(numberOfBags || 0);
            const bardanaNum = parseFloat(bardana || 0);
            const sutliNum = parseFloat(sutli || 0);
            const errors = {};

            if (!(bagsNum <= bardanaNum)) {
                errors.bardana = `Bardana must be ≥ No. of Bales/Bags (${bagsNum || 0})`;
            }
            if (!(bardanaNum <= sutliNum)) {
                errors.sutli = `Sutli must be ≥ Bardana (${bardanaNum || 0})`;
            }

            if (Object.keys(errors).length > 0) {
                setFieldErrors(errors);
                setStatusMessage({ text: 'Fix the highlighted Bardana/Sutli values before saving', type: 'error' });
                return;
            }
        }

        setFieldErrors({});
        setStatusMessage({ text: 'Saving Gatepass record...', type: 'info' });

        const resolvedCommodity = commodity === 'OTHER_PRODUCTS' ? customCommodity.trim().toUpperCase() : commodity;
        const resolvedHamalName = hamalName.trim().toUpperCase();
        const resolvedHamalId = normalizeItemName(resolvedHamalName);

        const payload = {
            gatePassNo: gatePassNo.toUpperCase() || null,
            date: date || new Date().toLocaleDateString('en-CA'),
            vehicleNumber: formatVehicleNumber(vehicleNumber) || null,
            destination: destination.toUpperCase() || null,
            driverName: driverName.toUpperCase() || '',
            driverPhone: driverPhone || '',
            commodity: resolvedCommodity || 'BALES',
            numberOfBags: numberOfBags ? parseInt(numberOfBags) : null,
            // Bardana/Sutli are not applicable to Cotton Bales — force them to
            // null on save even if a stale value somehow lingers in state.
            bardana: isBardanaSutliApplicable && bardana ? parseFloat(bardana) : null,
            sutli: isBardanaSutliApplicable && sutli ? parseFloat(sutli) : null,
            grossWt: grossWt ? parseFloat(grossWt) : null,
            tareWt: tareWt ? parseFloat(tareWt) : null,
            netWt: netWt ? parseFloat(netWt) : null,
            // Weight Timestamp Capture: exact moment each weight was entered,
            // stored as ISO strings so both the form and the printed slip can
            // render them in dd-mm HH:MM.
            grossWtTimestamp: grossWtTimestamp ? grossWtTimestamp.toISOString() : null,
            tareWtTimestamp: tareWtTimestamp ? tareWtTimestamp.toISOString() : null,
            hamalName: resolvedHamalName,
            hamalId: resolvedHamalId,
            isAdvancePayment: !!isAdvancePayment,
            advanceAmount: isAdvancePayment && advanceAmount ? roundAmt(advanceAmount) : null,
            driverPhoto: driverPhoto || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        try {
            if (isNewEntry) {
                // Doc ID format: [Gate Pass / Bill No.] - [Destination] - [Date]
                // The date segment was added so a gate pass number reused
                // against the same destination on a different day gets its
                // own document instead of silently overwriting an earlier one.
                const sanitize = (val) => String(val || '').trim().replace(/[/.#$[\]]/g, '-');
                const billPart = sanitize(payload.gatePassNo) || 'GP';
                const destinationPart = sanitize(payload.destination) || 'DEST';
                const datePart = sanitize(payload.date) || sanitize(new Date().toLocaleDateString('en-CA'));
                const docId = `${billPart}-${destinationPart}-${datePart}`;

                await setDoc(doc(db, 'javakEntries', docId), payload);
                await syncBardanaStockOut(docId, payload);
                await syncAdvancePaymentOut(docId, payload);
                setStatusMessage({ text: 'Gatepass generated successfully!', type: 'success' });
                resetState();
            } else {
                await updateDoc(doc(db, 'javakEntries', currentEntryId), payload);
                await syncBardanaStockOut(currentEntryId, payload);
                await syncAdvancePaymentOut(currentEntryId, payload);
                setStatusMessage({ text: 'Gatepass details updated successfully!', type: 'success' });
            }
        } catch (error) {
            console.error("Error saving to Firestore: ", error);
            setStatusMessage({ text: 'Error executing transaction. Try again.', type: 'error' });
        }
    };

    const handleDeleteEntry = async (id) => {
        try {
            await deleteDoc(doc(db, 'javakEntries', id));
            await deleteDoc(doc(db, 'cashTransactions', `javak_adv_${id}`)).catch(() => {});
            // Clean up any Bardana/Sutli stock movements routed from this
            // entry so deleting a Javak record doesn't leave orphaned OUT
            // entries sitting in the Bardana panel.
            try {
                const routedQuery = query(
                    collection(db, 'bardana'),
                    where('source', '==', 'JAVAK'),
                    where('sourceEntryId', '==', id)
                );
                const routedSnap = await getDocs(routedQuery);
                await Promise.all(routedSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
            } catch (cleanupErr) {
                console.error('Error clearing routed Bardana entries:', cleanupErr);
            }
            setStatusMessage({ text: 'Gatepass entry deleted.', type: 'success' });
            setDeleteConfirmId(null);
            resetState();
        } catch (error) {
            console.error("Firestore deletion failed: ", error);
            setStatusMessage({ text: 'Deletion error. Please retry.', type: 'error' });
        }
    };

    const handleShareWhatsApp = (tx) => {
        const messageText = `*Venkatesh Cotton Company Gate Pass*\n\nGate Pass No: ${tx.gatePassNo || tx.id}\nDate: ${tx.date}\nVehicle: ${tx.vehicleNumber}\nDestination: ${tx.destination}\nDriver Name: ${tx.driverName}\nCommodity: ${tx.commodity}\nNo. of Bags: ${tx.numberOfBags}\nBardana: ${tx.bardana || 0}\nSutli: ${tx.sutli || 0}\nNet Wt: ${tx.netWt} kg\n\nThank you, Have a safe journey!`;
        window.open('https://api.whatsapp.com/send?phone=91' + tx.driverPhone + '&text=' + encodeURIComponent(messageText), '_blank');
    };

    const generateJavakPdf = (entryToPrint) => {
        setPrintEntry(entryToPrint);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const formatVehicleNumber = (val) => {
        const cleaned = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        // Segment the raw characters the way they naturally alternate in a plate
        // (letters, digits, letters, digits) instead of forcing fixed slice
        // lengths — this lets the series be 1-3 letters and the number be
        // 1-4 digits, matching VEHICLE_NO_REGEX, rather than always 2 and 4.
        const match = cleaned.match(/^([A-Z]{1,2})([0-9]{1,2})?([A-Z]{1,3})?([0-9]{1,4})?/);
        if (!match) return cleaned;
        const [, state, rto, series, number] = match;
        return [state, rto, series, number].filter(Boolean).join('-');
    };

    const handleSelectEntry = (entry) => {
        setCurrentEntryId(entry.id);
        setIsNewEntry(false);
        setGatePassNo(entry.gatePassNo || '');
        setDate(entry.date || '');
        setVehicleNumber(entry.vehicleNumber || '');
        setDestination(entry.destination || '');
        setDriverName(entry.driverName || '');
        setDriverPhone(entry.driverPhone || '');
        const selectedCommodity = entry.commodity || 'BALES';
        if (commodityOptions.includes(selectedCommodity)) {
            setCommodity(selectedCommodity);
            setCustomCommodity('');
        } else {
            setCommodity('OTHER_PRODUCTS');
            setCustomCommodity(selectedCommodity);
        }
        setNumberOfBags(entry.numberOfBags || '');
        // Only restore Bardana/Sutli when the loaded entry's commodity is
        // actually eligible for them (i.e. not Cotton Bales).
        const loadedIsBales = selectedCommodity === 'BALES';
        setBardana(loadedIsBales ? '' : (entry.bardana || ''));
        setSutli(loadedIsBales ? '' : (entry.sutli || ''));
        setGrossWt(entry.grossWt || '');
        setTareWt(entry.tareWt || '');
        setNetWt(entry.netWt || '');
        // Weight Timestamp Capture: restore previously captured times so
        // re-opening a saved entry doesn't lose or reset them.
        setGrossWtTimestamp(entry.grossWtTimestamp ? new Date(entry.grossWtTimestamp) : null);
        setTareWtTimestamp(entry.tareWtTimestamp ? new Date(entry.tareWtTimestamp) : null);
        setHamalName(entry.hamalName || '');
        setHamalId(entry.hamalId || '');
        setIsAdvancePayment(!!entry.isAdvancePayment);
        setAdvanceAmount(entry.advanceAmount != null ? roundAmt(entry.advanceAmount) : '');
        setDriverPhoto(entry.driverPhoto || null);
    };

    // Full-field Export to Excel — mirrors Aavak's "Export" button. Exports
    // whatever is currently visible in the search-filtered dispatch log
    // (not just a hand-picked subset like Group Export), covering every
    // meaningful field stored on the javakEntries document.
    const handleExportToExcel = () => {
        const rows = filteredEntries.map(entry => ({
            "Date": entry.date || '',
            "Gate Pass No": entry.gatePassNo || '',
            "Vehicle Number": entry.vehicleNumber || '',
            "Destination": entry.destination || '',
            "Commodity": entry.commodity || '',
            "No. of Bags": entry.numberOfBags || '',
            "Bardana": entry.bardana || '',
            "Sutli": entry.sutli || '',
            "Gross Weight (kg)": entry.grossWt || '',
            "Gross Wt Time": formatWeightTimestamp(entry.grossWtTimestamp),
            "Tare Weight (kg)": entry.tareWt || '',
            "Tare Wt Time": formatWeightTimestamp(entry.tareWtTimestamp),
            "Net Weight (kg)": entry.netWt || '',
            "Hamal Name": entry.hamalName || '',
            "Driver Name": entry.driverName || '',
            "Driver Phone": entry.driverPhone || '',
            "Advance Payment Given": entry.isAdvancePayment ? 'YES' : 'NO',
            "Advance Amount": entry.isAdvancePayment ? roundAmt(entry.advanceAmount || 0) : ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Javak Reports");
        XLSX.writeFile(workbook, `Javak_Export_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    const bulkFilteredEntries = entries.filter(e => {
        if (!bulkSearchQuery) return true;
        const q = bulkSearchQuery.toLowerCase();
        return (e.destination && e.destination.toLowerCase().includes(q)) || (e.driverName && e.driverName.toLowerCase().includes(q));
    });

    const toggleBulkSelect = (id) => {
        setSelectedBulkIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAllBulk = () => {
        setSelectedBulkIds(prev => {
            const allSelected = bulkFilteredEntries.length > 0 && bulkFilteredEntries.every(e => prev.has(e.id));
            if (allSelected) return new Set();
            return new Set(bulkFilteredEntries.map(e => e.id));
        });
    };

    const getSelectedBulkEntries = () => entries.filter(e => selectedBulkIds.has(e.id));

    const closeBulkExport = () => {
        setIsBulkExportOpen(false);
        setBulkSearchQuery('');
        setSelectedBulkIds(new Set());
    };

    const handleBulkExportExcel = () => {
        const selected = getSelectedBulkEntries();
        if (selected.length === 0) {
            setStatusMessage({ text: 'Select at least one gate pass to export', type: 'error' });
            return;
        }
        const rows = selected.map(entry => ({
            "Date": entry.date || '',
            "Gate Pass No": entry.gatePassNo || '',
            "Driver Name": entry.driverName || '',
            "Destination": entry.destination || '',
            "Net Wt (kg)": entry.netWt || '',
            "Advance Amount": entry.isAdvancePayment ? roundAmt(entry.advanceAmount || 0) : ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Selected Gate Passes");
        XLSX.writeFile(workbook, `Javak_Group_Export_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    const handleBulkExportPdf = () => {
        const selected = getSelectedBulkEntries();
        if (selected.length === 0) {
            setStatusMessage({ text: 'Select at least one gate pass to export', type: 'error' });
            return;
        }
        setBulkPrintEntries(selected);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const resetState = () => {
        setCurrentEntryId(null);
        setIsNewEntry(false);
        setGatePassNo('');
        setDate(new Date().toLocaleDateString('en-CA'));
        setVehicleNumber('');
        setDestination('');
        setDriverName('');
        setDriverPhone('');
        setCommodity('BALES');
        setCustomCommodity('');
        setNumberOfBags('');
        setBardana('');
        setSutli('');
        setGrossWt('');
        setTareWt('');
        setNetWt('');
        setGrossWtTimestamp(null);
        setTareWtTimestamp(null);
        setHamalName('');
        setHamalId('');
        setIsAdvancePayment(false);
        setAdvanceAmount('');
        setDriverPhoto(null);
        setFieldErrors({});
        stopCamera();
    };

    useEffect(() => {
        const clearPrintEntry = () => setPrintEntry(null);
        window.addEventListener('afterprint', clearPrintEntry);
        return () => window.removeEventListener('afterprint', clearPrintEntry);
    }, []);

    useEffect(() => {
        const clearBulkPrintEntries = () => setBulkPrintEntries(null);
        window.addEventListener('afterprint', clearBulkPrintEntries);
        return () => window.removeEventListener('afterprint', clearBulkPrintEntries);
    }, []);

    const finalPrintData = printEntry || {};
    // Kata Operator signature line is auto-populated from the logged-in
    // session user (currentUser), never from the Javak entry itself, so it
    // always reflects whoever is printing the slip.
    const kataOperatorName = currentUser?.name || currentUser?.employeeId || currentUser?.employeeName || '';

    return (
        <div className="space-y-6">
            <style>{`
                @media screen {
                    .print-view-container, .vcc-bulk-report { display: none !important; }
                }
                @media print {
                    .vcc-bulk-report {
                        display: block !important;
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        padding: 10mm !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: 'Helvetica Neue', Arial, sans-serif !important;
                    }
                    .vcc-bulk-report * { visibility: visible !important; }
                    .vcc-bulk-report table { width: 100% !important; border-collapse: collapse !important; }
                    .vcc-bulk-report th, .vcc-bulk-report td {
                        border: 1px solid #000 !important;
                        padding: 5px 8px !important;
                        font-size: 10px !important;
                        text-align: left !important;
                    }
                    .vcc-bulk-report th { background: #f1f5f9 !important; font-weight: 700 !important; }
                    @page { size: A4; margin: 4mm 8mm; }
                    body * { visibility: hidden; }
                    .print-view-container, .print-view-container * { visibility: visible; }
                    .print-view-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        display: block !important;
                        opacity: 1 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .vcc-individual-slip {
                        height: 32% !important;
                        max-height: 32% !important;
                        page-break-inside: avoid !important;
                        box-sizing: border-box !important;
                    }
                }
            `}</style>
            
            <div 
                className="print-view-container font-sans text-black"
                style={{
                    maxHeight: '282mm',
                    overflow: 'hidden',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box'
                }}
            >
                {[0, 1, 2].map((copyIndex) => {
                    const getVal = (val) => {
                        if (val === undefined || val === null || val === "" || String(val).trim() === "") {
                            return null;
                        }
                        if (typeof val === 'string' && /^[_ ]+$/.test(val)) {
                            return null;
                        }
                        return val;
                    };

                    // NOTE: Hamal is intentionally NOT included in this `data`
                    // object — Hamal must never appear on the printed
                    // Javak slip/PDF, only in the on-screen form & exports.
                    const data = {
                        GATE_PASS_NO: getVal(finalPrintData?.gatePassNo),
                        VEHICLE_NO: getVal(finalPrintData?.vehicleNumber),
                        DESTINATION: getVal(finalPrintData?.destination),
                        COMMODITY: getVal(finalPrintData?.commodity),
                        GROSS: getVal(finalPrintData?.grossWt),
                        GROSS_TIME: getVal(formatWeightTimestamp(finalPrintData?.grossWtTimestamp)),
                        TARE: getVal(finalPrintData?.tareWt),
                        TARE_TIME: getVal(formatWeightTimestamp(finalPrintData?.tareWtTimestamp)),
                        NET: getVal(finalPrintData?.netWt),
                        BAGS: getVal(finalPrintData?.numberOfBags),
                        DATE: getVal(finalPrintData?.date),
                        DRIVER_NAME: getVal(finalPrintData?.driverName)
                    };

                    const imgSrc = finalPrintData?.driverPhoto || null;

                    return (
                        <section 
                            key={copyIndex} 
                            className="vcc-individual-slip"
                            style={{
                                height: '32%',
                                border: '1px solid #000000',
                                padding: '6px',
                                boxSizing: 'border-box',
                                marginBottom: '2px',
                                pageBreakInside: 'avoid',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                background: '#ffffff',
                                color: '#000000',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Header */}
                            <div style={{ textAlign: 'center', borderBottom: '2.5px solid #000000', paddingBottom: '3px', marginBottom: '4px' }}>
                                <h1 style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, padding: 0, lineHeight: '1.1', letterSpacing: '0.5px' }}>
                                    VENKATESH COTTON CO. | NH752, POMNALA, MAHARASHTRA 431801
                                </h1>
                            </div>

                            {/* Content Grid */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexGrow: 1 }}>
                                
                                {/* 2-column tabular layout */}
                                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: '2px' }}>
                                    
                                    {/* Row 1: GATE PASS NO. | VEHICLE NO. */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #000000', paddingBottom: '1px' }}>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>GATE PASS NO: </span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{data.GATE_PASS_NO || "___________"}</span>
                                        </div>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>VEHICLE NO: </span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{data.VEHICLE_NO || "___________"}</span>
                                        </div>
                                    </div>

                                    {/* Row 2: DESTINATION | COMMODITY */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #000000', paddingBottom: '1px' }}>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>DESTINATION: </span>
                                            <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{data.DESTINATION || "_________________"}</span>
                                        </div>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>COMMODITY: </span>
                                            <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{data.COMMODITY || "_________________"}</span>
                                        </div>
                                    </div>

                                    {/* Row 3: GROSS (KG) | TARE (KG) */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #000000', paddingBottom: '1px' }}>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>GROSS: </span>
                                            <span style={{ fontWeight: 'bold' }}>{data.GROSS || "________"} kg</span>
                                        </div>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>TARE: </span>
                                            <span style={{ fontWeight: 'bold' }}>{data.TARE || "________"} kg</span>
                                        </div>
                                    </div>

                                    {/* Row 3b: GROSS TIME | TARE TIME — Weight Timestamp Capture */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #000000', paddingBottom: '1px' }}>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>GROSS TIME: </span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{data.GROSS_TIME || "___________"}</span>
                                        </div>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>TARE TIME: </span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{data.TARE_TIME || "___________"}</span>
                                        </div>
                                    </div>

                                    {/* Row 4: NET (KG) | BAGS */}
                                    <div style={{ display: 'flex', borderBottom: '1px solid #000000', paddingBottom: '1px' }}>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>NET: </span>
                                            <span style={{ fontWeight: 'bold' }}>{data.NET || "________"} kg</span>
                                        </div>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>BAGS: </span>
                                            <span style={{ fontWeight: 'bold' }}>{data.BAGS || "____"}</span>
                                        </div>
                                    </div>

                                    {/* Row 5: DATE | DRIVER NAME */}
                                    <div style={{ display: 'flex', paddingBottom: '1px' }}>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>DATE: </span>
                                            <span style={{ fontWeight: 'bold' }}>{data.DATE || "__________"}</span>
                                        </div>
                                        <div style={{ width: '50%', fontSize: '8.5pt' }}>
                                            <span style={{ fontWeight: 'bold', display: 'inline', fontSize: '8pt' }}>DRIVER NAME: </span>
                                            <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{data.DRIVER_NAME || "______________________"}</span>
                                        </div>
                                    </div>

                                </div>

                                {/* Right Side Frame - No active Rupee symbols strictly */}
                                <div style={{ border: '1px solid #000000', width: '85px', height: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '8pt', flexShrink: 0, overflow: 'hidden' }}>
                                    {imgSrc ? (
                                        <img src={imgSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Driver" />
                                    ) : (
                                        "NO PHOTO AVAILABLE"
                                    )}
                                </div>

                            </div>

                            {/* Signature Block: Kata Operator (auto-filled from session user)
                                sits above Accountant, per slip. */}
                            <div style={{ marginTop: '3px', paddingTop: '2px', borderTop: '1px solid #000000', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <div style={{ fontSize: '7.5pt', fontWeight: 'bold' }}>
                                    KATA OPERATOR: <span style={{ textTransform: 'uppercase' }}>{kataOperatorName || '_______________'}</span>
                                </div>
                                <div style={{ fontSize: '7.5pt', fontWeight: 'bold' }}>
                                    ACCOUNTANT: _______________
                                </div>
                            </div>
                        </section>
                    );
                })}
            </div>

            {bulkPrintEntries && (
                <div className="vcc-bulk-report text-black">
                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '1px' }}>VENKATESH COTTON COMPANY</div>
                        <div style={{ fontSize: '10px', marginTop: '2px' }}>NH752, Pomnala, Maharashtra 431801 | Javak Group Report — {new Date().toLocaleDateString('en-CA')}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Gate Pass No</th>
                                <th>Driver Name</th>
                                <th>Destination</th>
                                <th>Net Wt (kg)</th>
                                <th>Advance Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bulkPrintEntries.map(entry => (
                                <tr key={entry.id}>
                                    <td>{entry.date}</td>
                                    <td>{entry.gatePassNo}</td>
                                    <td>{entry.driverName}</td>
                                    <td>{entry.destination}</td>
                                    <td>{entry.netWt}</td>
                                    <td>{entry.isAdvancePayment ? roundAmt(entry.advanceAmount || 0) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 font-extrabold text-xl">
                        J
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Javak Gate Pass</h1>
                        <p className="text-xs text-slate-500">Outward Bales & Seed Gatepasses, Weight Inspections & Truck Dispatch Desk</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => { resetState(); setIsNewEntry(true); }}
                        className="btn-primary flex items-center gap-2 bg-amber-600 hover:bg-amber-700 border-none shadow-md shadow-amber-100"
                    >
                        <Plus className="w-4 h-4" /> New Gate Pass
                    </button>
                    <button 
                        onClick={() => setIsBulkExportOpen(true)}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Users className="w-4 h-4" /> Group Export
                    </button>
                    <button onClick={handleExportToExcel} className="btn-secondary flex items-center gap-2 cursor-pointer">
                        <Download className="w-4 h-4" /> Export
                    </button>
                    {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                        <button onClick={() => generateJavakPdf({
                            gatePassNo: '___________',
                            date: '___________',
                            vehicleNumber: '___________',
                            destination: '___________',
                            driverName: '______________________',
                            commodity: '___________',
                            numberOfBags: '_____',
                            grossWt: '_____',
                            tareWt: '_____',
                            netWt: '_____',
                            bardana: '_____',
                            sutli: '_____'
                        })} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Blank Print
                        </button>
                    )}
                </div>
            </div>

            {statusMessage.text && (
                <div className={`p-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-between ${
                    statusMessage.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' :
                    statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                    'bg-amber-50 text-amber-600 dark:bg-slate-800'
                }`}>
                    <span>{statusMessage.text}</span>
                    <button onClick={() => setStatusMessage({ text: '', type: '' })} className="font-bold">✕</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    {(isNewEntry || currentEntryId) && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-6 shadow-sm">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest">{isNewEntry ? 'Generate gate pass' : 'Modify outward gate pass details'}</h3>
                                <button onClick={resetState} className="p-1 px-3 bg-slate-50 dark:bg-slate-800 dark:text-white hover:bg-slate-100 rounded-lg text-xs">✕ Close</button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Gate Pass No *</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="text" className="input-field pl-9 uppercase font-mono font-bold dark:bg-slate-800 dark:border-slate-700" value={gatePassNo} onChange={(e) => setGatePassNo(e.target.value)} required placeholder="GP-750" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Billing date</label>
                                        <input type="date" className="input-field dark:bg-slate-800 dark:border-slate-700" value={date} onChange={(e) => setDate(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Commodity Cargo</label>
                                        <select className="input-field font-bold dark:bg-slate-800 dark:border-slate-700" value={commodity} onChange={(e) => handleCommodityChange(e.target.value)}>
                                            <option value="BALES">COTTON BALES</option>
                                            <option value="COTTON SEED">COTTON SEED</option>
                                            <option value="KAPAS">KAPAS RAW</option>
                                            <option value="OTHER_PRODUCTS">Other Products</option>
                                        </select>
                                    </div>
                                    {commodity === 'OTHER_PRODUCTS' && (
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Custom Commodity *</label>
                                            <input type="text" className="input-field uppercase font-bold dark:bg-slate-800 dark:border-slate-700" value={customCommodity} onChange={(e) => setCustomCommodity(e.target.value)} required placeholder="Enter product name" />
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Vehicle Registration *</label>
                                        <div className="relative">
                                            <Truck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="text" className={`input-field pl-9 uppercase font-mono font-bold dark:bg-slate-800 ${vehicleNumber && !isValidVehicleNo(vehicleNumber) ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'dark:border-slate-700'}`} value={vehicleNumber} onChange={(e) => setVehicleNumber(formatVehicleNumber(e.target.value))} required placeholder="MH-26-Y-9000" pattern="^[A-Z]{2}-[0-9]{2}-[A-Z]{1,3}-[0-9]{1,4}$" title="Format: AA-00-A-0000 (e.g. MH-26-AB-9000)" />
                                        </div>
                                        {vehicleNumber && !isValidVehicleNo(vehicleNumber) && (
                                            <p className="mt-1 text-[9px] font-bold text-red-500 uppercase tracking-wide">Format: AA-00-A-0000 (e.g. MH-26-AB-9000)</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Cargo Destination *</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="text" className="input-field pl-9 uppercase font-bold dark:bg-slate-800 dark:border-slate-700" value={destination} onChange={(e) => setDestination(e.target.value)} required placeholder="e.g. GUJARAT, COIMBATORE" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">No. of Bales/Bags *</label>
                                        <div className="relative">
                                            <Package className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="number" className="input-field pl-9 font-bold dark:bg-slate-800" value={numberOfBags} onChange={(e) => setNumberOfBags(e.target.value)} required placeholder="Bales qty" />
                                        </div>
                                    </div>
                                </div>

                                {isBardanaSutliApplicable && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Bardana</label>
                                            <input type="number" step="0.01" className={`input-field font-bold dark:bg-slate-800 ${fieldErrors.bardana ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'dark:border-slate-700'}`} value={bardana} onChange={(e) => setBardana(e.target.value)} placeholder="Bardana" />
                                            {fieldErrors.bardana && (
                                                <p className="mt-1 text-[9px] font-bold text-red-500 uppercase tracking-wide">{fieldErrors.bardana}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Sutli</label>
                                            <input type="number" step="0.01" className={`input-field font-bold dark:bg-slate-800 ${fieldErrors.sutli ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'dark:border-slate-700'}`} value={sutli} onChange={(e) => setSutli(e.target.value)} placeholder="Sutli" />
                                            {fieldErrors.sutli && (
                                                <p className="mt-1 text-[9px] font-bold text-red-500 uppercase tracking-wide">{fieldErrors.sutli}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="p-5 bg-slate-50 dark:bg-slate-800/20 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-5 border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Truck Gross Weight (kg) *</label>
                                        <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800" value={grossWt} onChange={(e) => handleGrossWtChange(e.target.value)} required placeholder="Gross Wt" />
                                        {grossWtTimestamp && (
                                            <p className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-wide font-mono">Captured: {formatWeightTimestamp(grossWtTimestamp)}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Truck Tare Weight (kg) *</label>
                                        <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800" value={tareWt} onChange={(e) => handleTareWtChange(e.target.value)} required placeholder="Tare Wt" />
                                        {tareWtTimestamp && (
                                            <p className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-wide font-mono">Captured: {formatWeightTimestamp(tareWtTimestamp)}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col justify-center items-center p-3 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-lg">
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Calculated Net Weight</span>
                                        <span className="text-base font-black text-indigo-700 dark:text-blue-400">{netWt || '0.00'} kg</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Hamal Name *</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            className={`input-field pl-9 uppercase font-bold dark:bg-slate-800 ${!hamalName.trim() && fieldErrors.hamalName ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'dark:border-slate-700'}`}
                                            value={hamalName}
                                            onChange={(e) => setHamalName(e.target.value)}
                                            required
                                            placeholder="Hamal / loading labour name"
                                        />
                                    </div>
                                </div>

                                <div className="p-5 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-100 dark:border-emerald-950/20 space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                                            checked={isAdvancePayment}
                                            onChange={(e) => {
                                                setIsAdvancePayment(e.target.checked);
                                                if (!e.target.checked) setAdvanceAmount('');
                                            }}
                                        />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                            <IndianRupee className="w-3.5 h-3.5" /> Advance Payment given to Driver
                                        </span>
                                    </label>

                                    {isAdvancePayment && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Advance Amount *</label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    className="input-field font-bold text-emerald-700 dark:text-emerald-400 dark:bg-slate-800 dark:border-slate-700"
                                                    value={advanceAmount}
                                                    onChange={(e) => setAdvanceAmount(e.target.value)}
                                                    placeholder="0"
                                                    required={isAdvancePayment}
                                                />
                                            </div>
                                            <div className="flex flex-col justify-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-950/30">
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Will be logged in Cash Management as</span>
                                                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                                    Out : to {driverName || 'Driver Name'} | By: {currentUser?.name || 'Staff'} | Reason: Advance Payment for {vehicleNumber || 'Vehicle No'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Driver KYC Details</h4>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Driver Full Name</label>
                                            <input type="text" className="input-field uppercase dark:bg-slate-800" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Name as per DL" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Driver Phone Number</label>
                                            <input
                                                type="text"
                                                className={`input-field dark:bg-slate-800 ${driverPhone && !isValidPhone(driverPhone) ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                                                value={driverPhone}
                                                onChange={(e) => setDriverPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                                                placeholder="WhatsApp Contact"
                                                pattern="^[0-9]{10}$"
                                                title="Enter a valid 10-digit phone number"
                                                maxLength={10}
                                            />
                                            {driverPhone && !isValidPhone(driverPhone) && (
                                                <p className="mt-1 text-[9px] font-bold text-red-500 uppercase tracking-wide">Enter a valid 10-digit phone number</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Security Snapshot Camera</span>
                                        
                                        {driverPhoto ? (
                                            <div className="relative border border-slate-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                <img src={driverPhoto} className="w-[120px] h-[150px] object-cover rounded" alt="Driver" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setDriverPhoto(null)} 
                                                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : isCameraActive ? (
                                            <div className="relative flex flex-col items-center">
                                                <video id="camera-preview" autoPlay playsInline className="w-[200px] h-[150px] object-cover rounded-lg border border-slate-300 dark:border-slate-700 bg-black" />
                                                <div className="flex gap-2 mt-2">
                                                    <button type="button" onClick={capturePhoto} className="p-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded uppercase">Capture</button>
                                                    <button type="button" onClick={stopCamera} className="p-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-[10px] font-bold rounded uppercase">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                type="button" 
                                                onClick={startCamera} 
                                                className="p-4 px-6 border-2 border-dashed border-indigo-200 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-slate-700 rounded-xl flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase"
                                            >
                                                <Camera className="w-5 h-5" /> Activate Cam DL Verification
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <button 
                                        type="submit" 
                                        className="p-3 px-6 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-amber-100 dark:shadow-none flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Issue Gate Pass
                                    </button>
                                    <button type="button" onClick={resetState} className="p-3 px-6 bg-slate-105 hover:bg-slate-200 rounded-xl text-xs font-black dark:text-white uppercase">Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest">Active Dispatch Log</h3>
                        
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-150 dark:border-slate-800 text-[9px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        <th className="px-5 py-3">Gatepass No</th>
                                        <th className="px-5 py-3">Truck Details</th>
                                        <th className="px-5 py-3">Cargo Spec</th>
                                        <th className="px-5 py-3">Weight Specs</th>
                                        <th className="px-5 py-3">Driver Profile</th>
                                        <th className="px-5 py-3 text-right">Gatepass Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center p-8 text-xs font-semibold text-slate-400 uppercase">No active outward dispatches</td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map(e => (
                                            <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors whitespace-nowrap">
                                                <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-white">{e.gatePassNo || e.id}</td>
                                                <td className="px-5 py-4">
                                                    <div className="font-mono font-bold text-slate-900 dark:text-white">{e.vehicleNumber}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase">{e.destination} | {e.date}</div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="font-bold text-slate-900 dark:text-white">{e.commodity}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono font-bold">Qty: {e.numberOfBags} Bales</div>
                                                    {e.commodity !== 'BALES' && (
                                                        <div className="text-[10px] text-slate-400 font-mono">Bardana: {e.bardana || 0} | Sutli: {e.sutli || 0}</div>
                                                    )}
                                                    {e.hamalName && (
                                                        <div className="text-[10px] text-slate-400 font-mono">Hamal: {e.hamalName}</div>
                                                    )}
                                                    {e.isAdvancePayment && parseFloat(e.advanceAmount || 0) > 0 && (
                                                        <div className="text-[9px] font-black uppercase tracking-wider text-emerald-600 mt-0.5">Advance Paid: {roundAmt(e.advanceAmount || 0)}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 font-mono font-semibold">
                                                    <div>Net: <span className="font-bold text-slate-900 dark:text-white">{e.netWt} kg</span></div>
                                                    <div className="text-[9px] text-slate-400">G: {e.grossWt} | T: {e.tareWt}</div>
                                                    {(e.grossWtTimestamp || e.tareWtTimestamp) && (
                                                        <div className="text-[9px] text-slate-400">
                                                            {e.grossWtTimestamp && <>G-Time: {formatWeightTimestamp(e.grossWtTimestamp)} </>}
                                                            {e.tareWtTimestamp && <>T-Time: {formatWeightTimestamp(e.tareWtTimestamp)}</>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 flex items-center gap-2">
                                                    {e.driverPhoto && (
                                                        <img src={e.driverPhoto} className="w-8 h-10 object-cover rounded border border-slate-200" alt={e.driverName || 'Driver'} />
                                                    )}
                                                    <div>
                                                        <div className="font-extrabold text-slate-900 dark:text-white">{e.driverName || 'N/A'}</div>
                                                        <div className="text-[10px] text-slate-400">{e.driverPhone || 'N/A'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button 
                                                            onClick={() => generateJavakPdf(e)} 
                                                            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-500 dark:text-slate-400"
                                                            title="Print"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>

                                                    {e.driverPhone && (
                                                        <button 
                                                            onClick={() => handleShareWhatsApp(e)} 
                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100/50 rounded-lg text-emerald-600"
                                                            title="Share DL slip via WhatsApp"
                                                        >
                                                            <Share2 className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    <button 
                                                        onClick={() => handleSelectEntry(e)} 
                                                        className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 text-[10px] font-bold uppercase rounded p-1 px-3 ml-1"
                                                    >
                                                        Edit
                                                    </button>
                                                    
                                                    {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                                                        <button 
                                                            onClick={() => setDeleteConfirmId(e.id)} 
                                                            className="p-1.5 text-slate-400 hover:text-red-600"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <Search className="w-4 h-4 text-slate-400" />
                            <h4 className="text-[10px] font-black uppercase text-slate-900 dark:text-white tracking-widest">Verify Outlet Gate Pass</h4>
                        </div>
                        <input 
                            type="text" 
                            className="input-field font-mono font-bold dark:bg-slate-800 text-xs" 
                            placeholder="SEARCH/VERIFY RECORD..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {isBulkExportOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 max-w-2xl w-full p-6 rounded-2xl shadow-xl space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                            <div className="space-y-0.5">
                                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Group Export — Gate Passes</h4>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Search by Destination or Driver Name, select gate passes, then export</p>
                            </div>
                            <button onClick={closeBulkExport} className="p-1 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs rounded-lg dark:text-white cursor-pointer">✕</button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                className="input-field pl-9 uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                placeholder="Search Destination or Driver Name..."
                                value={bulkSearchQuery}
                                onChange={(e) => setBulkSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <button onClick={toggleSelectAllBulk} className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 cursor-pointer">
                                {bulkFilteredEntries.length > 0 && bulkFilteredEntries.every(e => selectedBulkIds.has(e.id)) ? (
                                    <CheckSquare className="w-4 h-4" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                Select All ({bulkFilteredEntries.length})
                            </button>
                            <span>{selectedBulkIds.size} Selected</span>
                        </div>

                        <div className="max-h-72 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                            {bulkFilteredEntries.length === 0 ? (
                                <div className="text-center p-8 text-xs font-semibold text-slate-400 uppercase">No gate passes match this search</div>
                            ) : (
                                bulkFilteredEntries.map(entry => (
                                    <label key={entry.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                                            checked={selectedBulkIds.has(entry.id)}
                                            onChange={() => toggleBulkSelect(entry.id)}
                                        />
                                        <div className="flex-1 flex items-center justify-between text-xs">
                                            <div>
                                                <div className="font-extrabold text-slate-900 dark:text-white">{entry.driverName || 'N/A'} <span className="text-slate-400 font-mono">#{entry.gatePassNo}</span></div>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-wider">{entry.destination} | {entry.date}</div>
                                            </div>
                                            <div className="text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {entry.netWt} kg
                                            </div>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleBulkExportExcel}
                                className="flex-1 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 uppercase tracking-wider text-white text-xs font-black shadow-lg shadow-emerald-100 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Export Excel
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkExportPdf}
                                className="flex-1 p-3 rounded-xl bg-amber-600 hover:bg-amber-700 uppercase tracking-wider text-white text-xs font-black shadow-lg shadow-amber-100 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Printer className="w-4 h-4" /> Export PDF
                            </button>
                            <button
                                type="button"
                                onClick={closeBulkExport}
                                className="p-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white uppercase tracking-wider text-xs font-black cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmId && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
                    <div className="bg-white dark:bg-slate-900 max-w-sm w-full p-6 rounded-2xl text-center space-y-4 shadow-xl border border-slate-150 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-sm tracking-wide">Are you absolute sure?</h4>
                        <p className="text-xs text-slate-500">This action permanently purges this gatepass outwards record database logs.</p>
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={() => handleDeleteEntry(deleteConfirmId)} className="btn-primary bg-red-600 hover:bg-red-700 font-bold text-xs p-2 px-6 uppercase tracking-wider shadow shadow-red-200">Yes Delete</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="btn-secondary text-xs uppercase font-bold p-2 px-6">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Javak;