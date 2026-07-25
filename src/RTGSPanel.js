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
  SplitSquareHorizontal
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
    const q = query(
      collection(db, collectionPath),
      where("paymentMode", "==", "RTGS")
    );

    // 2. REAL-TIME DATA SOURCE PIPELINE WITH SNAPSHOT LISTENER
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const mappedData = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();

            const amount = parseFloat(data.amountPaid || data.netAmount || data.amount || 0) || 0;

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
              : (parseFloat(rawMakerAmount) || 0);

            // Maker is only considered "done" once the maker amount fully
            // covers the bill. Anything less — even 1 rupee less — is a
            // partial/unsettled payment and must never be treated as done.
            const makerDone = amount > 0 && makerAmount >= amount;

            const chequePassedRaw = data.chequePassed === null || data.chequePassed === undefined
              ? true
              : data.chequePassed === true;

            return {
              id: docSnap.id,
              tokenNo: data.tokenNo || docSnap.id,
              farmerName: data.Name || data.farmerName || "UNKNOWN FARMER",
              farmerPhone: data.farmerPhone || "",
              amount,
              makerAmount,
              accountNumber: data.rtgsDetails?.accountNumber || "",
              makerDone,
              // Cheque Passed can never be true unless the maker amount is
              // fully settled, no matter what was last saved in Firestore.
              chequePassed: makerDone ? chequePassedRaw : false,
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

  // Status check helper. Order matters: partial payments are checked before
  // "done" so a half-paid maker amount can never fall through into a
  // completed-looking bucket.
  const getStatusInfo = (makerAmount, amount, makerDone, chequePassed) => {
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
    if (makerDone && !chequePassed) {
      return {
        label: "Clearance Pending",
        colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
      };
    }
    return {
      label: "Payment Completed",
      colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
    };
  };

  // 3. SECURE CHECKBOX CONTROLS WITH PREVENT OWNER MISTAKE GUARD (Cheque Passed only)
  const handleCheckboxToggle = async (id, currentValue) => {
    setIsUpdatingMap(prev => ({ ...prev, [id]: true }));
    const collectionPath = "cottonEntries";
    try {
      const docRef = doc(db, collectionPath, id);
      const newValue = !currentValue;

      await updateDoc(docRef, { chequePassed: newValue });

      // RTGS success confirmation: fires strictly the moment "Cheque Passed"
      // is freshly marked DONE (false -> true). Never on uncheck.
      if (newValue === true) {
        const tx = transactions.find(t => t.id === id);
        if (tx) {
          setRtgsConfirmation({
            amount: tx.amount,
            tokenNo: tx.tokenNo,
            accountLast4: (tx.accountNumber || "").slice(-4),
            farmerPhone: tx.farmerPhone || ""
          });
        }
      }
    } catch (err) {
      console.error("Error updating RTGS document status:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionPath}/${id}`, currentUser);
      } catch (errorObj) {
        alert(`Error: ${err instanceof Error ? err.message : "Operation failed"}`);
      }
    } finally {
      setIsUpdatingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  // Commits whatever is in the Maker Amount draft input for this row to
  // Firestore. Clamped to [0, full amount] — a maker can never be recorded as
  // having paid more than the bill. If the committed amount no longer fully
  // covers the bill, "Cheque Passed" is strictly forced back to false so a
  // partially-corrected entry can never keep sitting in "Completed".
  const commitMakerAmount = async (tx) => {
    const draftRaw = makerAmountDrafts[tx.id];
    let parsed = parseFloat(draftRaw);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
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
        ...(!newMakerDone ? { chequePassed: false } : {})
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

  const rtgsConfirmationMessage = rtgsConfirmation
    ? `Payment of Rupees ${(rtgsConfirmation.amount || 0).toLocaleString("en-IN")} against Token Number - ${rtgsConfirmation.tokenNo || ""} has been made to Account number ending ${rtgsConfirmation.accountLast4 || "----"} A/c Thankyou. VCC.`
    : "";

  const handleShareRtgsConfirmation = () => {
    if (!rtgsConfirmation?.farmerPhone) return;
    window.open(
      "https://api.whatsapp.com/send?phone=91" + rtgsConfirmation.farmerPhone + "&text=" + encodeURIComponent(rtgsConfirmationMessage),
      "_blank"
    );
  };

  // Filtered transaction logic
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.tokenNo?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.farmerName?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const statusInfo = getStatusInfo(tx.makerAmount, tx.amount, tx.makerDone, tx.chequePassed);
    if (statusFilter === "ALL") return true;
    return statusInfo.label.toUpperCase().replace(/ /g, "_") === statusFilter;
  });

  // Summary calculations.
  // IMPORTANT: completedAmount strictly only ever accumulates entries that
  // are BOTH fully maker-paid AND cheque-passed. Partial / unsettled amounts
  // are never folded into it, under any circumstance.
  const stats = transactions.reduce((acc, tx) => {
    acc.totalAmount += tx.amount;
    const outstanding = Math.max(0, tx.amount - tx.makerAmount);

    if (tx.makerAmount <= 0) {
      acc.makerPendingCount += 1;
      acc.pendingSettlementAmount += tx.amount;
    } else if (!tx.makerDone) {
      acc.partialCount += 1;
      acc.pendingSettlementAmount += outstanding;
    } else if (!tx.chequePassed) {
      acc.clearancePendingCount += 1;
    } else {
      acc.completedCount += 1;
      acc.completedAmount += tx.amount;
    }
    return acc;
  }, {
    totalAmount: 0,
    makerPendingCount: 0,
    partialCount: 0,
    clearancePendingCount: 0,
    completedCount: 0,
    completedAmount: 0,
    pendingSettlementAmount: 0
  });

  // 4. GENERATE AND SHARE RTGS REPORT PDF
  const handleShareWhatsAppPDF = async () => {
    try {
      const doc = new jsPDF();

      // Set Title and Branding details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("VENKATESH COTTON COMPANY", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("RTGS TRANSFER STATUS REPORT", 14, 26);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);
      
      const totalVolume = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      doc.text(`Filtered RTGS Volume: INR ${totalVolume.toLocaleString()}`, 14, 36);

      // Separator line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 40, 196, 40);

      // Setup Headers: Token, Farmer, Amount, Maker Paid, Balance, Status
      const headers = [["Token No.", "Farmer Name", "Amount", "Maker Paid", "Balance", "Status"]];
      
      let tableRows = [];
      if (filteredTransactions.length === 0) {
        tableRows = [
          ["_______", "_______", "_______", "_______", "_______", "_______"]
        ];
      } else {
        tableRows = filteredTransactions.map((tx) => {
          const tokenStr = tx.tokenNo || "_______";
          const nameStr = tx.farmerName || "_______";
          
          const amountFormatted = parseFloat(tx.amount || 0).toLocaleString();
          const makerPaidFormatted = parseFloat(tx.makerAmount || 0).toLocaleString();
          const balanceFormatted = Math.max(0, tx.amount - tx.makerAmount).toLocaleString();
          
          const statusInfo = getStatusInfo(tx.makerAmount, tx.amount, tx.makerDone, tx.chequePassed);
          const statusStr = statusInfo.label || "_______";

          return [
            String(tokenStr),
            nameStr.toUpperCase(),
            amountFormatted,
            makerPaidFormatted,
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
          4: { halign: "right" }
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
      const cleanFileName = `RTGS_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const file = new File([pdfBlob], cleanFileName, { type: "application/pdf" });

      // Native Browser Web Share API
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Venkatesh Cotton Co - RTGS Report",
          text: `Attached is the RTGS Transfer Status Report generated on ${new Date().toLocaleDateString()}.`
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

      {/* Stats Dashboard Grid */}
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
            <option value="PAYMENT_COMPLETED">PAYMENT COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Transactions Table Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header with WhatsApp Share Action */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight text-xs">
            RTGS Transaction Queue
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
                <th className="px-6 py-4 text-right">Amount (₹)</th>
                <th className="px-6 py-4">Maker Amount (Split Payment)</th>
                <th className="px-6 py-4 text-center">Cheque Passed</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/65 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Syncing live RTGS records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Ban className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                      <span>No records match the active criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const statusInfo = getStatusInfo(tx.makerAmount, tx.amount, tx.makerDone, tx.chequePassed);
                  const isLoadingRow = isUpdatingMap[tx.id];
                  const balance = Math.max(0, tx.amount - tx.makerAmount);
                  const draftValue = makerAmountDrafts[tx.id] ?? String(tx.makerAmount);

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
                      {/* Indian Number Formatting */}
                      <td className="px-6 py-4.5 text-right font-black text-slate-900 dark:text-slate-100 tabular-nums">
                        ₹{tx.amount.toLocaleString("en-IN")}
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
                              step="0.01"
                              disabled={isLoadingRow}
                              value={draftValue}
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
                            Partial — Balance ₹{balance.toLocaleString("en-IN")} still unsettled
                          </p>
                        )}
                      </td>
                      {/* Cheque Passed Checkbox with Prevent Owner Mistake Guard (disabled until Maker Amount fully settles the bill) */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="flex justify-center items-center">
                          <input 
                            type="checkbox"
                            checked={tx.chequePassed}
                            disabled={!tx.makerDone || isLoadingRow}
                            onChange={() => handleCheckboxToggle(tx.id, tx.chequePassed)}
                            className={`w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 transition-all ${
                              tx.makerDone 
                                ? "cursor-pointer" 
                                : "cursor-not-allowed opacity-40 bg-slate-100 dark:bg-slate-800"
                            }`}
                            title={!tx.makerDone ? "Requires the Maker Amount to fully cover the bill before cheque authorization." : ""}
                          />
                        </div>
                      </td>
                      {/* Status Flag badge - Calculated on-the-fly */}
                      <td className="px-6 py-4.5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.colorClass}`}>
                          {tx.makerDone && tx.chequePassed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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