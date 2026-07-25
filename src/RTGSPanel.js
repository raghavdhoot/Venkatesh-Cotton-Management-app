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
  Share2
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

// Central status resolver. All partial-payment logic funnels through here so
// the table, the filter, the PDF export, and the stats block can never disagree.
const getStatusInfo = (makerSettledAmount, amount, chequePassed) => {
  const settled = amount > 0 ? Math.min(Math.max(0, makerSettledAmount || 0), amount) : 0;
  const isFullySettled = amount > 0 && settled >= amount - 0.01;

  if (settled <= 0.01) {
    return {
      key: "MAKER_PENDING",
      label: "Maker Pending",
      colorClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50",
    };
  }
  if (!isFullySettled) {
    return {
      key: "PARTIALLY_PROCESSED",
      label: "Partially Processed",
      colorClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
    };
  }
  if (!chequePassed) {
    return {
      key: "CLEARANCE_PENDING",
      label: "Clearance Pending",
      colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
    };
  }
  return {
    key: "PAYMENT_COMPLETED",
    label: "Payment Completed",
    colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
  };
};

export default function RTGSPanel({ currentUser }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState(null);
  const [isUpdatingMap, setIsUpdatingMap] = useState({});
  const [rtgsConfirmation, setRtgsConfirmation] = useState(null);
  // Per-row typed-but-not-yet-submitted maker amount
  const [makerAmountInputs, setMakerAmountInputs] = useState({});

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
            const amount = data.amountPaid || data.netAmount || data.amount || 0;

            // Legacy support: old docs stored a single makerDone boolean, defaulting
            // to true when absent (pre-ticked). We fold that into an equivalent
            // settled amount so old records keep displaying correctly.
            const legacyMakerDone = data.makerDone === null || data.makerDone === undefined
              ? true
              : data.makerDone === true;

            const makerSettledAmount = data.makerSettledAmount !== undefined && data.makerSettledAmount !== null
              ? Math.max(0, Number(data.makerSettledAmount) || 0)
              : (legacyMakerDone ? amount : 0);

            const chequePassed = data.chequePassed === null || data.chequePassed === undefined
              ? true
              : data.chequePassed === true;

            return {
              id: docSnap.id,
              tokenNo: data.tokenNo || docSnap.id,
              farmerName: data.Name || data.farmerName || "UNKNOWN FARMER",
              farmerPhone: data.farmerPhone || "",
              amount,
              accountNumber: data.rtgsDetails?.accountNumber || "",
              makerSettledAmount,
              chequePassed,
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

  const handleMakerAmountInputChange = (id, val) => {
    setMakerAmountInputs(prev => ({ ...prev, [id]: val }));
  };

  // 3. MAKER PARTIAL PAYMENT SUBMISSION
  // Adds `amountValue` to the transaction's running makerSettledAmount. Rejects
  // anything <= 0 or that would push the running total past the RTGS amount.
  const submitMakerAmount = async (tx, amountValue) => {
    const entered = parseFloat(amountValue);
    const remaining = parseFloat((tx.amount - tx.makerSettledAmount).toFixed(2));

    if (isNaN(entered) || entered <= 0) {
      alert("Please enter a valid maker amount greater than zero.");
      return;
    }
    if (entered > remaining + 0.01) {
      alert(`Entered amount exceeds the remaining balance of ₹${remaining.toLocaleString("en-IN")}.`);
      return;
    }

    setIsUpdatingMap(prev => ({ ...prev, [tx.id]: true }));
    const collectionPath = "cottonEntries";
    try {
      const newSettled = parseFloat((tx.makerSettledAmount + entered).toFixed(2));
      const isFullySettled = newSettled >= tx.amount - 0.01;

      await updateDoc(doc(db, collectionPath, tx.id), {
        makerSettledAmount: newSettled,
        // Legacy boolean kept in sync purely for backward compatibility with
        // any other screen/report still reading makerDone directly.
        makerDone: isFullySettled,
      });

      setMakerAmountInputs(prev => ({ ...prev, [tx.id]: "" }));
    } catch (err) {
      console.error("Error updating maker settled amount:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionPath}/${tx.id}`, currentUser);
      } catch (errorObj) {
        alert(`Error: ${err instanceof Error ? err.message : "Operation failed"}`);
      }
    } finally {
      setIsUpdatingMap(prev => ({ ...prev, [tx.id]: false }));
    }
  };

  // 4. CHEQUE CLEARANCE TOGGLE — hard-guarded: cannot fire unless the maker
  // amount has been fully settled first (input is disabled in the UI too,
  // this is the belt-and-braces check).
  const handleChequeToggle = async (tx) => {
    const isFullySettled = tx.amount > 0 && tx.makerSettledAmount >= tx.amount - 0.01;
    if (!isFullySettled) return;

    setIsUpdatingMap(prev => ({ ...prev, [tx.id]: true }));
    const collectionPath = "cottonEntries";
    try {
      const newValue = !tx.chequePassed;
      await updateDoc(doc(db, collectionPath, tx.id), { chequePassed: newValue });

      // RTGS success confirmation: fires strictly the moment "Cheque Passed"
      // is freshly marked DONE (false -> true), and only once the maker
      // amount is fully settled.
      if (newValue === true) {
        setRtgsConfirmation({
          amount: tx.amount,
          tokenNo: tx.tokenNo,
          accountLast4: (tx.accountNumber || "").slice(-4),
          farmerPhone: tx.farmerPhone || ""
        });
      }
    } catch (err) {
      console.error("Error updating cheque status:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionPath}/${tx.id}`, currentUser);
      } catch (errorObj) {
        alert(`Error: ${err instanceof Error ? err.message : "Operation failed"}`);
      }
    } finally {
      setIsUpdatingMap(prev => ({ ...prev, [tx.id]: false }));
    }
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
    if (statusFilter === "ALL") return true;

    const statusInfo = getStatusInfo(tx.makerSettledAmount, tx.amount, tx.chequePassed);
    return statusInfo.key === statusFilter;
  });

  // Summary calculations.
  // IMPORTANT: completedAmount is only ever touched inside the PAYMENT_COMPLETED
  // branch. Partially-processed amounts live in partialProcessedAmount and must
  // never be folded into completedAmount, regardless of how this is refactored later.
  const stats = transactions.reduce((acc, tx) => {
    acc.totalAmount += tx.amount;
    const statusInfo = getStatusInfo(tx.makerSettledAmount, tx.amount, tx.chequePassed);

    if (statusInfo.key === "MAKER_PENDING") {
      acc.makerPendingCount += 1;
    } else if (statusInfo.key === "PARTIALLY_PROCESSED") {
      acc.partialCount += 1;
      acc.partialProcessedAmount += tx.makerSettledAmount; // informational only
    } else if (statusInfo.key === "CLEARANCE_PENDING") {
      acc.clearancePendingCount += 1;
    } else {
      acc.completedCount += 1;
      acc.completedAmount += tx.amount; // ONLY fully-settled + cheque-passed entries land here
    }
    return acc;
  }, {
    totalAmount: 0,
    makerPendingCount: 0,
    partialCount: 0,
    partialProcessedAmount: 0,
    clearancePendingCount: 0,
    completedCount: 0,
    completedAmount: 0
  });

  // 5. GENERATE AND SHARE RTGS REPORT PDF
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

      // Setup Headers
      const headers = [["Token No.", "Farmer Name", "Amount", "Maker Settled", "Status"]];
      
      let tableRows = [];
      if (filteredTransactions.length === 0) {
        tableRows = [
          ["_______", "_______", "_______", "_______", "_______"]
        ];
      } else {
        tableRows = filteredTransactions.map((tx) => {
          const tokenStr = tx.tokenNo || "_______";
          const nameStr = tx.farmerName || "_______";
          const amountFormatted = parseFloat(tx.amount || 0).toLocaleString();
          const settledFormatted = parseFloat(tx.makerSettledAmount || 0).toLocaleString();
          const statusInfo = getStatusInfo(tx.makerSettledAmount, tx.amount, tx.chequePassed);

          return [
            String(tokenStr),
            nameStr.toUpperCase(),
            amountFormatted,
            settledFormatted,
            statusInfo.label.toUpperCase()
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
          3: { halign: "right" }
        },
        didDrawPage: (data) => {
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

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Venkatesh Cotton Co - RTGS Report",
          text: `Attached is the RTGS Transfer Status Report generated on ${new Date().toLocaleDateString()}.`
        });
      } else {
        doc.save(cleanFileName);
      }
    } catch (error) {
      console.error("Error sharing or generating PDF:", error);
      try {
        const doc = new jsPDF();
        doc.text("Venkatesh Cotton Company - RTGS Report", 14, 20);
        doc.save(`RTGS_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (e) {
        console.error("Fallback save failed", e);
      }
    }
  };

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

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 rounded-xl flex items-start gap-3 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Transaction Synced System Notice:</span> {error}
          </div>
        </div>
      )}

      {/* Stats Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total RTGS Volume</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            ₹{stats.totalAmount.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Maker Pending</p>
          <p className="text-2xl font-black text-red-500 mt-2 flex items-center gap-2">
            {stats.makerPendingCount}
            {stats.makerPendingCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Partially Processed</p>
          <p className="text-2xl font-black text-blue-500 mt-2 flex items-center gap-2">
            {stats.partialCount}
            {stats.partialCount > 0 && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
          </p>
          {stats.partialCount > 0 && (
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
              ₹{stats.partialProcessedAmount.toLocaleString("en-IN")} in-flight (not counted as completed)
            </p>
          )}
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clearance Pending</p>
          <p className="text-2xl font-black text-amber-500 mt-2 flex items-center gap-2">
            {stats.clearancePendingCount}
            {stats.clearancePendingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
          </p>
        </div>
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Payment Completed</p>
          <p className="text-2xl font-black text-emerald-500 mt-2">
            {stats.completedCount}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-semibold">
            ₹{stats.completedAmount.toLocaleString("en-IN")} strictly settled
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
            <option value="PARTIALLY_PROCESSED">PARTIALLY PROCESSED</option>
            <option value="CLEARANCE_PENDING">CLEARANCE PENDING</option>
            <option value="PAYMENT_COMPLETED">PAYMENT COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Transactions Table Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
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
              <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Token No</th>
                <th className="px-6 py-4">Farmer Name</th>
                <th className="px-6 py-4 text-right">Amount (₹)</th>
                <th className="px-6 py-4">Maker Processing</th>
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
                  const statusInfo = getStatusInfo(tx.makerSettledAmount, tx.amount, tx.chequePassed);
                  const isLoadingRow = isUpdatingMap[tx.id];
                  const isFullySettled = tx.amount > 0 && tx.makerSettledAmount >= tx.amount - 0.01;
                  const remaining = Math.max(0, parseFloat((tx.amount - tx.makerSettledAmount).toFixed(2)));
                  const progressPct = tx.amount > 0 ? Math.min(100, (tx.makerSettledAmount / tx.amount) * 100) : 0;

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
                      <td className="px-6 py-4.5 text-right font-black text-slate-900 dark:text-slate-100 tabular-nums">
                        ₹{tx.amount.toLocaleString("en-IN")}
                      </td>

                      {/* Maker Processing — partial amount entry */}
                      <td className="px-6 py-4.5 normal-case">
                        <div className="space-y-1.5 min-w-[190px]">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <span>₹{tx.makerSettledAmount.toLocaleString("en-IN")} / ₹{tx.amount.toLocaleString("en-IN")}</span>
                            {!isFullySettled && <span className="text-blue-500">{Math.round(progressPct)}%</span>}
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isFullySettled ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          {isFullySettled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> Fully Processed
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder={`Up to ${remaining}`}
                                value={makerAmountInputs[tx.id] || ""}
                                onChange={(e) => handleMakerAmountInputChange(tx.id, e.target.value)}
                                disabled={isLoadingRow}
                                className="w-24 text-xs input-field py-1 px-2 normal-case dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => submitMakerAmount(tx, makerAmountInputs[tx.id])}
                                disabled={isLoadingRow}
                                className="text-[9px] font-black uppercase px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => submitMakerAmount(tx, remaining)}
                                disabled={isLoadingRow}
                                className="text-[9px] font-black uppercase px-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 text-slate-600 rounded-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Full
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Cheque Passed — locked until maker amount is fully settled */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="flex justify-center items-center">
                          <input 
                            type="checkbox"
                            checked={tx.chequePassed}
                            disabled={!isFullySettled || isLoadingRow}
                            onChange={() => handleChequeToggle(tx)}
                            className={`w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 transition-all ${
                              isFullySettled 
                                ? "cursor-pointer" 
                                : "cursor-not-allowed opacity-40 bg-slate-100 dark:bg-slate-800"
                            }`}
                            title={!isFullySettled ? "Requires the maker amount to be fully processed before cheque authorization." : ""}
                          />
                        </div>
                      </td>

                      <td className="px-6 py-4.5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.colorClass}`}>
                          {statusInfo.key === "PAYMENT_COMPLETED" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : statusInfo.key === "CLEARANCE_PENDING" || statusInfo.key === "PARTIALLY_PROCESSED" ? (
                            <Clock className="w-3.5 h-3.5" />
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