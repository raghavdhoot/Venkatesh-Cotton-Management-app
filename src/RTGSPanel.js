import React, { useState, useEffect } from "react";
import { db } from "./firebaseConfig";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
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

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface RTGSPanelProps {
  currentUser: any;
}

interface RTGSTransaction {
  id: string;
  tokenNo: string;
  farmerName: string;
  amount: number;
  makerDone: boolean;
  chequePassed: boolean;
}

// Custom firestore error handler conforming to standard guidelines
function handleFirestoreError(error: any, operationType: OperationType, path: string, currentUser: any) {
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

export default function RTGSPanel({ currentUser }: RTGSPanelProps) {
  const [transactions, setTransactions] = useState<RTGSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingMap, setIsUpdatingMap] = useState<Record<string, boolean>>({});

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
            // Serial No. 7: RTGS Checkbox Automation
            // All entries here are already RTGS (filtered by query).
            // If makerDone / chequePassed are null or undefined in Firestore,
            // default them to true so checkboxes appear pre-ticked.
            // Explicit false (user unchecked) is preserved as false.
            const makerDone = data.makerDone === null || data.makerDone === undefined
              ? true
              : data.makerDone === true;
            const chequePassed = data.chequePassed === null || data.chequePassed === undefined
              ? true
              : data.chequePassed === true;

            return {
              id: docSnap.id,
              tokenNo: data.tokenNo || docSnap.id,
              farmerName: data.Name || data.farmerName || "UNKNOWN FARMER",
              amount: data.amountPaid || data.netAmount || data.amount || 0,
              makerDone,
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

  // Status check helper
  const getStatusInfo = (makerDone: boolean, chequePassed: boolean) => {
    if (!makerDone && !chequePassed) {
      return {
        label: "Maker Pending",
        colorClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50",
        textClass: "text-red-600 dark:text-red-400 font-bold"
      };
    }
    if (makerDone && !chequePassed) {
      return {
        label: "Clearance Pending",
        colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
        textClass: "text-amber-600 dark:text-amber-500 font-bold"
      };
    }
    return {
      label: "Payment Completed",
      colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
      textClass: "text-emerald-600 dark:text-emerald-400 font-bold"
    };
  };

  // 3. SECURE CHECKBOX CONTROLS WITH PREVENT OWNER MISTAKE GUARD
  const handleCheckboxToggle = async (id: string, field: string, currentValue: boolean) => {
    setIsUpdatingMap(prev => ({ ...prev, [id]: true }));
    const collectionPath = "cottonEntries";
    try {
      const docRef = doc(db, collectionPath, id);
      let updatePayload: Record<string, any> = {};

      if (field === "makerDone") {
        const newMakerValue = !currentValue;
        updatePayload.makerDone = newMakerValue;
        
        // PREVENT OWNER MISTAKE GUARD:
        // Reset Cheque Passed to false if Maker Done is toggled back to false.
        if (!newMakerValue) {
          updatePayload.chequePassed = false;
        }
      } else if (field === "chequePassed") {
        updatePayload.chequePassed = !currentValue;
      }

      await updateDoc(docRef, updatePayload);
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

  // Filtered transaction logic
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.tokenNo?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.farmerName?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const statusInfo = getStatusInfo(tx.makerDone, tx.chequePassed);
    if (statusFilter === "ALL") return true;
    return statusInfo.label.toUpperCase().replace(" ", "_") === statusFilter;
  });

  // Summary calculations
  const stats = transactions.reduce((acc, tx) => {
    acc.totalAmount += tx.amount;
    if (!tx.makerDone && !tx.chequePassed) {
      acc.makerPendingCount += 1;
    } else if (tx.makerDone && !tx.chequePassed) {
      acc.clearancePendingCount += 1;
    } else {
      acc.completedCount += 1;
    }
    return acc;
  }, { totalAmount: 0, makerPendingCount: 0, clearancePendingCount: 0, completedCount: 0 });

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

      // Setup Headers: exactly mapped 4 columns
      const headers = [["Token No.", "Farmer Name", "Amount", "Status"]];
      
      let tableRows: string[][] = [];
      if (filteredTransactions.length === 0) {
        // If empty, fill with standard underscores '_______' as requested
        tableRows = [
          ["_______", "_______", "_______", "_______"]
        ];
      } else {
        tableRows = filteredTransactions.map((tx) => {
          const tokenStr = tx.tokenNo || "_______";
          const nameStr = tx.farmerName || "_______";
          
          // Ensure no Indian Rupee symbols (₹) are embedded in amount column or any cell text
          const amountFormatted = parseFloat(tx.amount || 0).toLocaleString();
          
          const statusInfo = getStatusInfo(tx.makerDone, tx.chequePassed);
          const statusStr = statusInfo.label || "_______";

          return [
            String(tokenStr),
            nameStr.toUpperCase(),
            amountFormatted,
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
          2: { halign: "right" }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-full pl-10 uppercase dark:bg-slate-900 dark:border-slate-800 dark:text-white"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="MAKER_PENDING">MAKER PENDING</option>
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
                <th className="px-6 py-4 text-center">Maker Done</th>
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
                  const statusInfo = getStatusInfo(tx.makerDone, tx.chequePassed);
                  const isLoadingRow = isUpdatingMap[tx.id];

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
                      {/* Maker Checkbox */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="flex justify-center items-center">
                          <input 
                            type="checkbox"
                            checked={tx.makerDone}
                            disabled={isLoadingRow}
                            onChange={() => handleCheckboxToggle(tx.id, "makerDone", tx.makerDone)}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </div>
                      </td>
                      {/* Cheque Passed Checkbox with Prevent Owner Mistake Guard (disabled if makerDone is false) */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="flex justify-center items-center">
                          <input 
                            type="checkbox"
                            checked={tx.chequePassed}
                            disabled={!tx.makerDone || isLoadingRow}
                            onChange={() => handleCheckboxToggle(tx.id, "chequePassed", tx.chequePassed)}
                            className={`w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 transition-all ${
                              tx.makerDone 
                                ? "cursor-pointer" 
                                : "cursor-not-allowed opacity-40 bg-slate-100 dark:bg-slate-800"
                            }`}
                            title={!tx.makerDone ? "Requires 'Maker Done' approval before cheque authorization." : ""}
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
    </div>
  );
}
