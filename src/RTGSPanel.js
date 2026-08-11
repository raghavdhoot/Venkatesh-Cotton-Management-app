import React, { useState, useEffect } from "react";
import { db } from "./firebaseConfig";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";
import {
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Ban,
  RefreshCw,
  Share2,
  SplitSquareHorizontal,
  PieChart,
  CalendarCheck2,
  CalendarClock,
  Calendar
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Final-amount rounding helper: every monetary value that gets persisted,
// stored, rendered on screen, or printed on a PDF report must be a whole
// rupee amount. Applied consistently everywhere a final amount is produced
// or displayed.
const roundAmt = (val) => Math.round(parseFloat(val) || 0);

const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write",
};

// Custom firestore error handler conforming to standard guidelines
function handleFirestoreError(error, operationType, path, currentUser) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.employeeId || null,
      name: currentUser?.name || null,
      role: currentUser?.role || null,
    },
    operationType,
    path
  };
  console.error("Firestore Error Details: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Classifies an entry into the Due Payments or Maturity Payments sub-panel.
// Rule: if there is no due date on the entry (i.e. it's payable immediately)
// or the due date has already arrived/passed, it belongs in Due Payments.
// Only a due date that hasn't been reached yet holds the payment in the
// Maturity Payments sub-panel.
function classifyDueOrMaturity(dueDateRaw) {
  if (!dueDateRaw) {
    return { category: "DUE", dueDateObj: null };
  }
  const parsedDate = new Date(dueDateRaw);
  if (isNaN(parsedDate.getTime())) {
    return { category: "DUE", dueDateObj: null };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueOnly = new Date(parsedDate);
  dueOnly.setHours(0, 0, 0, 0);
  const category = dueOnly.getTime() > today.getTime() ? "MATURITY" : "DUE";
  return { category, dueDateObj: parsedDate };
}

export default function RTGSPanel({ currentUser }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState(null);
  const [isUpdatingMap, setIsUpdatingMap] = useState({});
  const [rtgsConfirmation, setRtgsConfirmation] = useState(null);
  // Local editable drafts for the "Maker Amount" input, keyed by entry id.
  // Lets someone type a partial amount without every keystroke round-tripping
  // to Firestore; the value only commits on blur / Enter / the Full button.
  const [makerAmountDrafts, setMakerAmountDrafts] = useState({});
  // Same draft pattern as above, but for the "Cheque / RTGS Passed" amount —
  // this replaces the old single Cheque Passed checkbox so the bank-side
  // clearance can also be recorded as a partial amount (-> "Partially Passed").
  const [chequePassedDrafts, setChequePassedDrafts] = useState({});
  // Dual sub-panel toggle: Due Payments (payable now / due date has arrived
  // or passed) vs Maturity Payments (waiting on a future due date).
  const [activeTab, setActiveTab] = useState("DUE");

  // 1. ADMIN & CASHIER ACCESS GUARD Check (Visible to designated roles in App.tsx)
  const isAdmin = currentUser && (
    currentUser.role?.toUpperCase() === "ADMIN" || 
    currentUser.employeeId?.toUpperCase() === "ADMIN" ||
    currentUser.role?.toUpperCase() === "CASHIER"
  );

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const collectionPath = "cottonEntries";
    // RTGS Panel Visibility Fix: Aavak's payment mode now saves as
    // 'RTGS_IMMEDIATE' or 'RTGS_DUE' (expanded payment mode set) instead of
    // the old bare 'RTGS' value. A strict equality query on 'RTGS' silently
    // excluded every entry saved after that change — switched to an 'in'
    // query so both new values match, while 'RTGS' is kept in the list so
    // any legacy entries saved before the expansion still show up too.
    const q = query(
      collection(db, collectionPath),
      where("paymentMode", "in", ["RTGS", "RTGS_IMMEDIATE", "RTGS_DUE"])
    );

    // 2. REAL-TIME DATA SOURCE PIPELINE WITH SNAPSHOT LISTENER
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const mappedData = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();

            const amount = roundAmt(data.amountPaid || data.netAmount || data.amount || 0);

            // Legacy support: entries saved before "Maker Amount" existed only
            // ever had a boolean makerDone (defaulting to true when absent).
            // If makerAmount was never recorded, backfill it from that legacy
            // flag: fully paid if makerDone was true, otherwise zero.
            const legacyMakerDone = data.makerDone === null || data.makerDone === undefined
              ? true
              : data.makerDone === true;

            const rawMakerAmount = data.makerAmount;
            const makerAmount = (rawMakerAmount === null || rawMakerAmount === undefined)
              ? (legacyMakerDone ? amount : 0)
              : roundAmt(rawMakerAmount);

            // Maker is only considered "done" once the maker amount fully
            // covers the bill. Anything less — even 1 rupee less — is a
            // partial/unsettled payment and must never be treated as done.
            const makerDone = amount > 0 && makerAmount >= amount;

            // Legacy support: entries saved before "Cheque Passed Amount"
            // existed only ever had a boolean chequePassed (defaulting to
            // true when absent). If chequePassedAmount was never recorded,
            // backfill it from that legacy flag: fully passed if true,
            // otherwise zero.
            const legacyChequePassed = data.chequePassed === null || data.chequePassed === undefined
              ? true
              : data.chequePassed === true;

            const rawChequePassedAmount = data.chequePassedAmount;
            const chequePassedAmountUnclamped = (rawChequePassedAmount === null || rawChequePassedAmount === undefined)
              ? (legacyChequePassed ? amount : 0)
              : roundAmt(rawChequePassedAmount);

            // Cheque/RTGS clearance can never be recorded — partially or in
            // full — unless the Maker Amount already fully covers the bill,
            // no matter what was last saved in Firestore.
            const chequePassedAmount = makerDone ? Math.min(chequePassedAmountUnclamped, amount) : 0;
            const chequePassed = amount > 0 && chequePassedAmount >= amount;

            // Due date field fix: Aavak stores the payment due date as
            // `paymentDueDate` (see isDueMode()/dataPayload in Aavak.js),
            // not `dueDate`. Reading the wrong field meant every RTGS_DUE
            // entry silently fell back to `null` and got misclassified as
            // "DUE" instead of "MATURITY" here. `dueDate` and
            // `rtgsDetails?.dueDate` are kept as fallbacks only for any
            // older/legacy records that may have used those field names.
            const dueDateRaw = data.paymentDueDate || data.dueDate || data.rtgsDetails?.dueDate || null;
            const { category, dueDateObj } = classifyDueOrMaturity(dueDateRaw);

            return {
              id: docSnap.id,
              tokenNo: data.tokenNo || docSnap.id,
              farmerName: data.Name || data.farmerName || "UNKNOWN FARMER",
              farmerPhone: data.farmerPhone || "",
              amount,
              makerAmount,
              accountNumber: data.rtgsDetails?.accountNumber || "",
              makerDone,
              chequePassedAmount,
              chequePassed,
              dueDate: dueDateRaw,
              dueDateObj,
              category,
            };
          });
          setTransactions(mappedData);
          setError(null);
          setLoading(false);
        } catch (err) {
          console.error("Mapping error:", err);
          setError("Failed to map database transaction data properly.");
          setLoading(false);
        }
      },
      (err) => {
        setError("Permission denied or failed to load real-time database live stream.");
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.GET, collectionPath, currentUser);
        } catch (caughtErr) {
          // Handled/logged above already
        }
      }
    );

    return () => unsubscribe();
  }, [isAdmin, currentUser]);

  // Seed a local draft for any transaction that doesn't have one yet, so the
  // Maker Amount input always has something to show. Existing drafts (i.e.
  // whatever the person is actively typing) are left untouched.
  useEffect(() => {
    setMakerAmountDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      transactions.forEach((tx) => {
        if (next[tx.id] === undefined) {
          next[tx.id] = String(tx.makerAmount);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [transactions]);

  // Same seeding pattern as Maker Amount, for the Cheque / RTGS Passed
  // amount drafts.
  useEffect(() => {
    setChequePassedDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      transactions.forEach((tx) => {
        if (next[tx.id] === undefined) {
          next[tx.id] = String(tx.chequePassedAmount);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [transactions]);

  // Status check helper. Order matters: each partial state is checked before
  // the state "ahead" of it in the pipeline, so a half-settled entry can
  // never fall through into a more-complete-looking bucket.
  //   Maker Pending -> Partial Payment -> Clearance Pending
  //     -> Partially Passed -> Payment Completed
  const getStatusInfo = (makerAmount, amount, makerDone, chequePassedAmount) => {
    if (makerAmount <= 0) {
      return {
        label: "Maker Pending",
        colorClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50",
      };
    }
    if (!makerDone) {
      return {
        label: "Partial Payment",
        colorClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50",
      };
    }
    if (chequePassedAmount <= 0) {
      return {
        label: "Clearance Pending",
        colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
      };
    }
    if (chequePassedAmount < amount) {
      return {
        label: "Partially Passed",
        colorClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/50",
      };
    }
    return {
      label: "Payment Completed",
      colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
    };
  };

  // Commits whatever is in the Maker Amount draft input for this row to
  // Firestore. Clamped to [0, full amount] — a maker can never be recorded as
  // having paid more than the bill. If the committed amount no longer fully
  // covers the bill, Cheque/RTGS Passed Amount is strictly forced back to
  // zero so a partially-corrected entry can never keep sitting in a
  // completed-looking status.
  const commitMakerAmount = async (tx) => {
    const draftRaw = makerAmountDrafts[tx.id];
    let parsed = roundAmt(draftRaw);
    if (parsed < 0) parsed = 0;
    if (parsed > tx.amount) parsed = tx.amount;

    setMakerAmountDrafts(prev => ({ ...prev, [tx.id]: String(parsed) }));

    if (parsed === tx.makerAmount) return; // nothing changed, skip the write

    setIsUpdatingMap(prev => ({ ...prev, [tx.id]: true }));
    const collectionPath = "cottonEntries";
    try {
      const newMakerDone = tx.amount > 0 && parsed >= tx.amount;
      const updatePayload = {
        makerAmount: parsed,
        makerDone: newMakerDone,
        ...(!newMakerDone ? { chequePassedAmount: 0, chequePassed: false } : {})
      };
      await updateDoc(doc(db, collectionPath, tx.id), updatePayload);
    } catch (err) {
      console.error("Error updating Maker Amount:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionPath}/${tx.id}`, currentUser);
      } catch (errorObj) {
        alert(`Error: ${err instanceof Error ? err.message : "Operation failed"}`);
      }
    } finally {
      setIsUpdatingMap(prev => ({ ...prev, [tx.id]: false }));
    }
  };

  const markMakerAmountFull = (tx) => {
    setMakerAmountDrafts(prev => ({ ...prev, [tx.id]: String(tx.amount) }));
    commitMakerAmount(tx);
  };

  // Commits whatever is in the Cheque/RTGS Passed draft input for this row.
  // Clamped to [0, full amount]. Disabled entirely (guarded in the UI) until
  // the Maker Amount fully covers the bill, mirroring the old checkbox's
  // "Prevent Owner Mistake" guard — the difference now is the bank can pass
  // the bill partially, landing the entry in "Partially Passed" instead of
  // jumping straight from Clearance Pending to Completed.
  const commitChequePassedAmount = async (tx) => {
    if (!tx.makerDone) return;

    const draftRaw = chequePassedDrafts[tx.id];
    let parsed = roundAmt(draftRaw);
    if (parsed < 0) parsed = 0;
    if (parsed > tx.amount) parsed = tx.amount;

    setChequePassedDrafts(prev => ({ ...prev, [tx.id]: String(parsed) }));

    if (parsed === tx.chequePassedAmount) return; // nothing changed, skip the write

    setIsUpdatingMap(prev => ({ ...prev, [tx.id]: true }));
    const collectionPath = "cottonEntries";
    try {
      const newChequePassed = tx.amount > 0 && parsed >= tx.amount;
      const wasFullyPassed = tx.amount > 0 && tx.chequePassedAmount >= tx.amount;

      await updateDoc(doc(db, collectionPath, tx.id), {
        chequePassedAmount: parsed,
        chequePassed: newChequePassed
      });

      // RTGS success confirmation: fires strictly the moment the cheque/RTGS
      // amount newly reaches full settlement (partial -> fully passed).
      // Never fires on a downward edit, and never while still partial.
      if (newChequePassed && !wasFullyPassed) {
        setRtgsConfirmation({
          amount: roundAmt(tx.amount),
          tokenNo: tx.tokenNo,
          accountLast4: (tx.accountNumber || "").slice(-4),
          farmerPhone: tx.farmerPhone || ""
        });
      }
    } catch (err) {
      console.error("Error updating Cheque/RTGS Passed Amount:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionPath}/${tx.id}`, currentUser);
      } catch (errorObj) {
        alert(`Error: ${err instanceof Error ? err.message : "Operation failed"}`);
      }
    } finally {
      setIsUpdatingMap(prev => ({ ...prev, [tx.id]: false }));
    }
  };

  const markChequePassedFull = (tx) => {
    setChequePassedDrafts(prev => ({ ...prev, [tx.id]: String(tx.amount) }));
    commitChequePassedAmount(tx);
  };

  const rtgsConfirmationMessage = rtgsConfirmation
    ? `Payment of Rupees ${roundAmt(rtgsConfirmation.amount || 0).toLocaleString("en-IN")} against Token Number - ${rtgsConfirmation.tokenNo || ""} has been made to Account number ending ${rtgsConfirmation.accountLast4 || "----"} A/c Thankyou. VCC.`
    : "";

  const handleShareRtgsConfirmation = () => {
    if (!rtgsConfirmation?.farmerPhone) return;
    window.open(
      "https://api.whatsapp.com/send?phone=91" + rtgsConfirmation.farmerPhone + "&text=" + encodeURIComponent(rtgsConfirmationMessage),
      "_blank"
    );
  };

  // Dual sub-panel split: Due Payments (payable now — no due date, or the
  // due date has arrived/passed) vs Maturity Payments (a future due date
  // hasn't been reached yet). Everything below — stats, search, status
  // filter, the table, and the PDF export — operates only on the active
  // sub-panel's transactions.
  const dueTransactions = transactions.filter(tx => tx.category === "DUE");
  const maturityTransactions = transactions.filter(tx => tx.category === "MATURITY");
  const tabTransactions = activeTab === "MATURITY" ? maturityTransactions : dueTransactions;

  // Filtered transaction logic (scoped to the active Due/Maturity sub-panel)
  const filteredTransactions = tabTransactions.filter(tx => {
    const matchesSearch = 
      tx.tokenNo?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.farmerName?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const statusInfo = getStatusInfo(tx.makerAmount, tx.amount, tx.makerDone, tx.chequePassedAmount);
    if (statusFilter === "ALL") return true;
    return statusInfo.label.toUpperCase().replace(/ /g, "_") === statusFilter;
  });

  // Summary calculations, scoped to the active Due/Maturity sub-panel.
  // IMPORTANT: completedAmount strictly only ever accumulates entries that
  // are BOTH fully maker-paid AND fully cheque/RTGS-passed. Partial /
  // unsettled amounts are never folded into it, under any circumstance.
  const stats = tabTransactions.reduce((acc, tx) => {
    acc.totalAmount += roundAmt(tx.amount);
    const makerOutstanding = Math.max(0, roundAmt(tx.amount) - roundAmt(tx.makerAmount));
    const chequeOutstanding = Math.max(0, roundAmt(tx.amount) - roundAmt(tx.chequePassedAmount));

    if (tx.makerAmount <= 0) {
      acc.makerPendingCount += 1;
      acc.pendingSettlementAmount += roundAmt(tx.amount);
    } else if (!tx.makerDone) {
      acc.partialCount += 1;
      acc.pendingSettlementAmount += makerOutstanding;
    } else if (tx.chequePassedAmount <= 0) {
      acc.clearancePendingCount += 1;
    } else if (tx.chequePassedAmount < tx.amount) {
      acc.partiallyPassedCount += 1;
      acc.partiallyPassedAmount += chequeOutstanding;
    } else {
      acc.completedCount += 1;
      acc.completedAmount += roundAmt(tx.amount);
    }
    return acc;
  }, {
    totalAmount: 0,
    makerPendingCount: 0,
    partialCount: 0,
    clearancePendingCount: 0,
    partiallyPassedCount: 0,
    partiallyPassedAmount: 0,
    completedCount: 0,
    completedAmount: 0,
    pendingSettlementAmount: 0
  });

  const formatDueDate = (tx) => {
    if (!tx.dueDateObj) return "IMMEDIATE";
    return tx.dueDateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  // 4. GENERATE AND SHARE RTGS REPORT PDF (active Due/Maturity sub-panel only)
  const handleShareWhatsAppPDF = async () => {
    try {
      const doc = new jsPDF();
      const panelLabel = activeTab === "MATURITY" ? "MATURITY PAYMENTS" : "DUE PAYMENTS";

      // Set Title and Branding details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("VENKATESH COTTON COMPANY", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`RTGS TRANSFER STATUS REPORT — ${panelLabel}`, 14, 26);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);
      
      const totalVolume = filteredTransactions.reduce((sum, tx) => sum + roundAmt(tx.amount), 0);
      doc.text(`Filtered RTGS Volume: INR ${totalVolume.toLocaleString()}`, 14, 36);

      // Separator line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 40, 196, 40);

      // Setup Headers: Token, Farmer, Amount, Maker Paid, Cheque Passed, Balance, Status
      const headers = [["Token No.", "Farmer Name", "Amount", "Maker Paid", "Cheque Passed", "Balance", "Status"]];
      
      let tableRows = [];
      if (filteredTransactions.length === 0) {
        tableRows = [
          ["_______", "_______", "_______", "_______", "_______", "_______", "_______"]
        ];
      } else {
        tableRows = filteredTransactions.map((tx) => {
          const tokenStr = tx.tokenNo || "_______";
          const nameStr = tx.farmerName || "_______";
          
          const amountFormatted = roundAmt(tx.amount || 0).toLocaleString();
          const makerPaidFormatted = roundAmt(tx.makerAmount || 0).toLocaleString();
          const chequePassedFormatted = roundAmt(tx.chequePassedAmount || 0).toLocaleString();
          const balanceFormatted = Math.max(0, roundAmt(tx.amount) - roundAmt(tx.chequePassedAmount)).toLocaleString();
          
          const statusInfo = getStatusInfo(tx.makerAmount, tx.amount, tx.makerDone, tx.chequePassedAmount);
          const statusStr = statusInfo.label || "_______";

          return [
            String(tokenStr),
            nameStr.toUpperCase(),
            amountFormatted,
            makerPaidFormatted,
            chequePassedFormatted,
            balanceFormatted,
            statusStr.toUpperCase()
          ];
        });
      }

      autoTable(doc, {
        startY: 45,
        head: headers,
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [37, 211, 102], // WhatsApp Green (#25D366)
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" }
        },
        didDrawPage: (data) => {
          // Footer
          doc.setFontSize(8);
          doc.setTextColor(156, 163, 175);
          doc.text(
            `Page ${data.pageNumber} of ${data.pageNumber}`,
            14,
            doc.internal.pageSize.height - 10
          );
        }
      });

      const pdfBlob = doc.output("blob");
      const cleanFileName = `RTGS_Report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const file = new File([pdfBlob], cleanFileName, { type: "application/pdf" });

      // Native Browser Web Share API
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Venkatesh Cotton Co - RTGS Report",
          text: `Attached is the RTGS Transfer Status Report (${panelLabel}) generated on ${new Date().toLocaleDateString()}.`
        });
      } else {
        // Fallback method: Download PDF directly using file save
        doc.save(cleanFileName);
      }
    } catch (error) {
      console.error("Error sharing or generating PDF:", error);
      // Fallback direct download
      try {
        const doc = new jsPDF();
        doc.text("Venkatesh Cotton Company - RTGS Report", 14, 20);
        doc.save(`RTGS_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (e) {
        console.error("Fallback save failed", e);
      }
    }
  };

  // Render access denied UI if not authorized
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-w-lg mx-auto my-8 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase">⛔ ACCESS DENIED</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          This administrative zone is secure. You do not have permissions to access the RTGS Transfer Authorization controls.
        </p>
      </div>
    );
  }

  return (
    <div id="rtgs-panel-container" className="space-y-6">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">RTGS Transfer Panel</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Authorizing and tracking electronic bank transfers to farming partners.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
          <span className="text-xs font-mono font-bold uppercase px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full border border-slate-200 dark:border-slate-700/50">
            ADMIN SECURE ROUTE
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-xl flex items-start gap-3 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Transaction Synced System Notice:</span> {error}
          </div>
        </div>
      )}

      {/* Due Payments / Maturity Payments Sub-Panel Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("DUE")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === "DUE"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <CalendarCheck2 className="w-4 h-4" />
          Due Payments
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px]">{dueTransactions.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("MATURITY")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === "MATURITY"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          Maturity Payments
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px]">{maturityTransactions.length}</span>
        </button>
      </div>

      {/* Stats Dashboard Grid (scoped to the active sub-panel) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total RTGS Volume</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            ₹{stats.totalAmount.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Settled &amp; Completed</p>
          <p className="text-2xl font-black text-emerald-500 mt-2">
            ₹{stats.completedAmount.toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{stats.completedCount} entries</p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending Settlement</p>
          <p className="text-2xl font-black text-red-500 mt-2">
            ₹{stats.pendingSettlementAmount.toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Never counted as completed</p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Maker Pending</p>
          <p className="text-2xl font-black text-red-500 mt-2 flex items-center gap-2">
            {stats.makerPendingCount}
            {stats.makerPendingCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Partial Payments</p>
          <p className="text-2xl font-black text-sky-500 mt-2 flex items-center gap-2">
            {stats.partialCount}
            {stats.partialCount > 0 && <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clearance Pending</p>
          <p className="text-2xl font-black text-amber-500 mt-2 flex items-center gap-2">
            {stats.clearancePendingCount}
            {stats.clearancePendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Partially Passed</p>
          <p className="text-2xl font-black text-violet-500 mt-2 flex items-center gap-2">
            {stats.partiallyPassedCount}
            {stats.partiallyPassedCount > 0 && <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />}
          </p>
          {stats.partiallyPassedCount > 0 && (
            <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">₹{stats.partiallyPassedAmount.toLocaleString("en-IN")} still unpassed</p>
          )}
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="SEARCH TOKEN OR FARMER..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            className="input-field w-full pl-10 uppercase dark:bg-slate-900 dark:border-slate-800 dark:text-white"
          />
        </div>
        <div className="relative min-w-[220px]">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-full pl-10 uppercase dark:bg-slate-900 dark:border-slate-800 dark:text-white"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="MAKER_PENDING">MAKER PENDING</option>
            <option value="PARTIAL_PAYMENT">PARTIAL PAYMENT</option>
            <option value="CLEARANCE_PENDING">CLEARANCE PENDING</option>
            <option value="PARTIALLY_PASSED">PARTIALLY PASSED</option>
            <option value="PAYMENT_COMPLETED">PAYMENT COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Transactions Table Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header with WhatsApp Share Action */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight text-xs">
            {activeTab === "MATURITY" ? "Maturity Payments Queue" : "Due Payments Queue"}
          </h3>
          <button
            onClick={handleShareWhatsAppPDF}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1ca34d] text-white text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
            title="Share complete RTGS status report via WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            Share RTGS Report via WhatsApp
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest selection:bg-indigo-100">
                <th className="px-6 py-4">Token No</th>
                <th className="px-6 py-4">Farmer Name</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Amount (₹)</th>
                <th className="px-6 py-4">Maker Amount (Split Payment)</th>
                <th className="px-6 py-4">Cheque / RTGS Passed (₹)</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/65 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Syncing live RTGS records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Ban className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                      <span>No records match the active criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const statusInfo = getStatusInfo(tx.makerAmount, tx.amount, tx.makerDone, tx.chequePassedAmount);
                  const isLoadingRow = isUpdatingMap[tx.id];
                  const makerBalance = Math.max(0, roundAmt(tx.amount) - roundAmt(tx.makerAmount));
                  const chequeBalance = Math.max(0, roundAmt(tx.amount) - roundAmt(tx.chequePassedAmount));
                  const makerDraftValue = makerAmountDrafts[tx.id] ?? String(tx.makerAmount);
                  const chequeDraftValue = chequePassedDrafts[tx.id] ?? String(tx.chequePassedAmount);

                  return (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors uppercase"
                    >
                      <td className="px-6 py-4.5 font-bold text-slate-900 dark:text-white tracking-tight">
                        {tx.tokenNo}
                      </td>
                      <td className="px-6 py-4.5 font-semibold text-slate-700 dark:text-slate-300">
                        {tx.farmerName}
                      </td>
                      <td className="px-6 py-4.5 text-slate-500 dark:text-slate-400 normal-case">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDueDate(tx)}
                        </div>
                      </td>
                      {/* Indian Number Formatting */}
                      <td className="px-6 py-4.5 text-right font-black text-slate-900 dark:text-slate-100 tabular-nums">
                        ₹{roundAmt(tx.amount).toLocaleString("en-IN")}
                      </td>
                      {/* Maker Amount: custom partial-payment entry */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-2 normal-case">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              max={tx.amount}
                              step="1"
                              disabled={isLoadingRow}
                              value={makerDraftValue}
                              onChange={(e) => setMakerAmountDrafts(prev => ({ ...prev, [tx.id]: e.target.value }))}
                              onBlur={() => commitMakerAmount(tx)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                              className="w-28 pl-5 pr-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                            />
                          </div>
                          {!tx.makerDone && (
                            <button
                              type="button"
                              disabled={isLoadingRow}
                              onClick={() => markMakerAmountFull(tx)}
                              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              title="Mark full amount as paid by maker"
                            >
                              <SplitSquareHorizontal className="w-3 h-3" /> Full
                            </button>
                          )}
                        </div>
                        {tx.makerAmount > 0 && !tx.makerDone && (
                          <p className="text-[9px] font-bold text-sky-600 dark:text-sky-400 mt-1 normal-case">
                            Partial — Balance ₹{makerBalance.toLocaleString("en-IN")} still unsettled
                          </p>
                        )}
                      </td>
                      {/* Cheque / RTGS Passed Amount: mirrors the Maker Amount
                          split-payment input, but for the bank-side clearance.
                          Guarded (disabled) until the Maker Amount fully
                          covers the bill. */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-2 normal-case">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              max={tx.amount}
                              step="1"
                              disabled={!tx.makerDone || isLoadingRow}
                              value={chequeDraftValue}
                              onChange={(e) => setChequePassedDrafts(prev => ({ ...prev, [tx.id]: e.target.value }))}
                              onBlur={() => commitChequePassedAmount(tx)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                              className={`w-28 pl-5 pr-2 py-1.5 text-xs font-bold rounded-lg border dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 ${
                                tx.makerDone
                                  ? "border-slate-200 dark:border-slate-700"
                                  : "border-slate-200 dark:border-slate-700 cursor-not-allowed bg-slate-100 dark:bg-slate-800"
                              }`}
                              title={!tx.makerDone ? "Requires the Maker Amount to fully cover the bill before cheque/RTGS authorization." : ""}
                            />
                          </div>
                          {tx.makerDone && tx.chequePassedAmount < tx.amount && (
                            <button
                              type="button"
                              disabled={isLoadingRow}
                              onClick={() => markChequePassedFull(tx)}
                              className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              title="Mark full amount as passed by the bank"
                            >
                              <PieChart className="w-3 h-3" /> Full
                            </button>
                          )}
                        </div>
                        {tx.makerDone && tx.chequePassedAmount > 0 && tx.chequePassedAmount < tx.amount && (
                          <p className="text-[9px] font-bold text-violet-600 dark:text-violet-400 mt-1 normal-case">
                            Partially Passed — Balance ₹{chequeBalance.toLocaleString("en-IN")} still unpassed
                          </p>
                        )}
                      </td>
                      {/* Status Flag badge - Calculated on-the-fly */}
                      <td className="px-6 py-4.5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.colorClass}`}>
                          {tx.makerDone && tx.chequePassedAmount >= tx.amount ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : tx.makerDone && tx.chequePassedAmount > 0 ? (
                            <PieChart className="w-3.5 h-3.5 text-violet-500" />
                          ) : tx.makerDone ? (
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                          ) : tx.makerAmount > 0 ? (
                            <SplitSquareHorizontal className="w-3.5 h-3.5 text-sky-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rtgsConfirmation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full p-6 rounded-2xl shadow-2xl text-center space-y-5 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 mx-auto bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">RTGS Payment Successful</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed px-2">{rtgsConfirmationMessage}</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              {rtgsConfirmation.farmerPhone && (
                <button
                  onClick={handleShareRtgsConfirmation}
                  className="p-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl uppercase tracking-wider shadow-md shadow-emerald-200 dark:shadow-none cursor-pointer"
                >
                  Share on WhatsApp
                </button>
              )}
              <button
                onClick={() => setRtgsConfirmation(null)}
                className="p-2.5 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}