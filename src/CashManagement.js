import React, { useState, useEffect } from "react";
import { db } from "./firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  getDocs,
  deleteDoc,
  doc,
  where
} from "firebase/firestore";
import {
  IndianRupee,
  Plus,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Wallet,
  Lock,
  Unlock,
  Share2,
  Clock,
  CalendarDays
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getTodayDateStr = () => {
  return formatDate(new Date());
};

export default function CashManagement({ currentUser }) {
  const todayStr = getTodayDateStr();
  const [transactions, setTransactions] = useState([]);
  const [type, setType] = useState("OUT");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });
  const [sourceSelect, setSourceSelect] = useState("SBI");
  const [customSource, setCustomSource] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [todayClosure, setTodayClosure] = useState(null);
  const [maturedEntries, setMaturedEntries] = useState([]);
  const [forecastDate, setForecastDate] = useState(todayStr);
  // Raw Aavak entries, kept only so we can pull out installmentLogs — these
  // are payments made TODAY settling balance on bills booked on an EARLIER
  // date. Aavak.js writes them straight onto the cottonEntries doc and never
  // mirrors them into 'cashTransactions', so without this they were
  // completely invisible to Cash Management / the EOD report.
  const [aavakEntries, setAavakEntries] = useState([]);

  const isAuthorized =
    currentUser?.role?.toUpperCase() === "ADMIN" ||
    currentUser?.employeeId === "ADMIN" ||
    currentUser?.role?.toUpperCase() === "CASHIER";

  useEffect(() => {
    if (!isAuthorized) return;
    const q = query(collection(db, "cashTransactions"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [isAuthorized]);

  // Pulls every Aavak entry so its installmentLogs (older-bill settlements)
  // can be folded into the cash ledger below. Full-collection listen is
  // deliberate: there's no indexable field to filter "has an installment
  // paid today" server-side since installmentLogs is a nested array.
  useEffect(() => {
    if (!isAuthorized) return;
    const unsubscribeAavak = onSnapshot(
      collection(db, "cottonEntries"),
      (snapshot) => {
        setAavakEntries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Error loading Aavak entries for installment sync:", err);
      }
    );
    return () => unsubscribeAavak();
  }, [isAuthorized]);

  // Maturity Forecast now queries whichever date is selected via the calendar
  // picker (defaults to today), instead of being locked to today's date only.
  useEffect(() => {
    if (!isAuthorized || !forecastDate) return;
    const maturityQuery = query(collection(db, "cottonEntries"), where("paymentDueDate", "==", forecastDate));
    const unsubscribeMaturity = onSnapshot(
      maturityQuery,
      (snapshot) => {
        const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMaturedEntries(entries);
      },
      (error) => {
        console.error("Maturity forecast query error: ", error);
      }
    );
    return () => unsubscribeMaturity();
  }, [isAuthorized, forecastDate]);

  useEffect(() => {
    if (!isAuthorized) return;
    const todayStr = getTodayDateStr();

    const unsubToday = onSnapshot(doc(db, "dailyClosures", `Closure-${todayStr}`), (docSnap) => {
      if (docSnap.exists()) {
        setTodayClosure({ id: docSnap.id, ...docSnap.data() });
      } else {
        setTodayClosure(null);
      }
    });

    const q = query(collection(db, "dailyClosures"), orderBy("createdAt", "desc"), limit(1));
    const unsubLatestClosure = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const lastClosureDoc = snapshot.docs[0].data();
          setOpeningBalance(lastClosureDoc.closingBalance || lastClosureDoc.expectedClosingBalance || 0);
        } else {
          const qFallback = query(collection(db, "dailyClosures"), orderBy("timestamp", "desc"), limit(1));
          getDocs(qFallback)
            .then((fallbackSnapshot) => {
              if (!fallbackSnapshot.empty) {
                const lastDoc = fallbackSnapshot.docs[0].data();
                setOpeningBalance(lastDoc.closingBalance || lastDoc.expectedClosingBalance || 0);
              } else {
                setOpeningBalance(0);
              }
            })
            .catch(() => {
              setOpeningBalance(0);
            });
        }
      },
      (error) => {
        console.error("Error fetching latest closure on mount:", error);
        setOpeningBalance(0);
      }
    );

    return () => {
      unsubToday();
      unsubLatestClosure();
    };
  }, [isAuthorized]);

  // Flatten every Aavak entry's installmentLogs into transaction-shaped rows
  // so older-bill settlements paid today sit in the same ledger as normal
  // cash transactions and Javak advances.
  const installmentTransactions = React.useMemo(() => {
    const rows = [];
    aavakEntries.forEach((entry) => {
      (entry.installmentLogs || []).forEach((log, idx) => {
        rows.push({
          id: `aavak-installment-${entry.id}-${idx}`,
          type: "OUT",
          amount: parseFloat(log.amount || 0) || 0,
          recipient: entry.Name || entry.farmerName || "FARMER",
          reason: `AAVAK INSTALLMENT — TOKEN ${entry.tokenNo || entry.id} (OLDER BILL SETTLEMENT)`,
          recordedBy: log.operator || "Staff",
          source: "AAVAK_INSTALLMENT",
          _logDate: log.date || null,
          displayTimestamp: log.date ? `${log.date} ${log.time || ""}`.trim() : "PENDING",
          isSynthetic: true
        });
      });
    });
    return rows;
  }, [aavakEntries]);

  // Everything that should count as "money moving through the drawer" —
  // manual cash entries, Javak advances (already written into
  // cashTransactions by Javak.js), and Aavak installment settlements — merged
  // into one ledger so nothing silently falls outside the EOD report.
  const combinedTransactions = React.useMemo(() => {
    const getSortKey = (t) => {
      if (t.timestamp && typeof t.timestamp.toDate === "function") {
        try { return t.timestamp.toDate().getTime(); } catch (e) { /* fall through */ }
      }
      if (t._logDate) {
        const parsed = Date.parse(t._logDate);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };
    return [...transactions, ...installmentTransactions].sort((a, b) => getSortKey(b) - getSortKey(a));
  }, [transactions, installmentTransactions]);

  // Robust "is this today" check. Doc IDs no longer reliably encode a date
  // (Javak/Aavak doc IDs are now [Token/Bill No.]-[Amount/Destination], with
  // no date component), so the date field / timestamp are checked first and
  // the old id-substring check is kept only as a last-resort fallback for
  // legacy manual cash entries.
  const isTransactionToday = (t) => {
    if (t._logDate) return t._logDate === todayStr;
    if (t.date && typeof t.date === "string") return t.date === todayStr;
    if (t.timestamp && typeof t.timestamp.toDate === "function") {
      try {
        return formatDate(t.timestamp.toDate()) === todayStr;
      } catch (e) {
        // fall through to id check
      }
    }
    if (t.id && t.id.includes(todayStr)) return true;
    return false;
  };

  useEffect(() => {
    if (statusMessage.text) {
      const timer = setTimeout(() => setStatusMessage({ text: "", type: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) return;

    if (type === "OUT" && !reason.trim()) {
      setStatusMessage({ text: "Reason is strictly required for Cash Out transactions", type: "error" });
      return;
    }

    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const querySnapshot = await getDocs(collection(db, "cashTransactions"));
      const todayEntries = querySnapshot.docs.filter((docVal) => docVal.id.includes(dateStr));
      const count = todayEntries.length;

      const nextSrNo = count + 1;
      const srNo = String(nextSrNo).padStart(2, "0");

      let customIdSuffix = "";
      if (type === "IN") {
        if (sourceSelect === "SBI" || sourceSelect === "Rajesh") {
          customIdSuffix = sourceSelect;
        } else {
          const cleanCustom = customSource.trim().replace(/\s+/g, "");
          const cleanReason = reason.trim().replace(/\s+/g, "");
          customIdSuffix = cleanReason || cleanCustom || "Other";
        }
      } else {
        customIdSuffix = reason.trim().replace(/\s+/g, "");
      }

      const customId = `${srNo}-${dateStr}-${amount}-${customIdSuffix}`;

      const finalSource =
        type === "IN" ? (sourceSelect === "Other" ? customSource.trim() || "Other" : sourceSelect) : "N/A";

      const finalReason = reason.trim()
        ? reason.toUpperCase()
        : type === "IN"
        ? `CASH IN FROM ${finalSource.toUpperCase()}`
        : "N/A";

      await setDoc(doc(db, "cashTransactions", customId), {
        type,
        amount: parseFloat(amount),
        source: finalSource.toUpperCase(),
        recipient: type === "OUT" ? recipient.toUpperCase() || "N/A" : "N/A",
        reason: finalReason,
        recordedBy: currentUser?.name || "N/A",
        timestamp: serverTimestamp()
      });

      setStatusMessage({ text: "Transaction recorded!", type: "success" });
      resetForm();
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error adding transaction:", error);
      setStatusMessage({ text: "Error recording transaction", type: "error" });
    }
  };

  const resetForm = () => {
    setAmount("");
    setRecipient("");
    setReason("");
    setType("OUT");
    setSourceSelect("SBI");
    setCustomSource("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await deleteDoc(doc(db, "cashTransactions", id));
      setStatusMessage({ text: "Transaction deleted", type: "success" });
    } catch (error) {
      console.error("Error deleting:", error);
      setStatusMessage({ text: "Error deleting", type: "error" });
    }
  };

  // All-time totals now run over combinedTransactions (cashTransactions +
  // Javak advances already inside it + Aavak installment settlements) since
  // installment payouts are real cash leaving the same drawer, not a
  // separate ledger.
  const totalIn = combinedTransactions
    .filter((t) => t.type === "IN")
    .reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);
  const totalOut = combinedTransactions
    .filter((t) => t.type !== "IN")
    .reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);
  const balance = totalIn - totalOut;

  const todayTransactions = combinedTransactions.filter(isTransactionToday);

  const todayIn = todayTransactions
    .filter((t) => t.type === "IN")
    .reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);
  const todayOut = todayTransactions
    .filter((t) => t.type !== "IN")
    .reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);

  // Breakdown shown on the EOD card so Javak advances and Aavak installment
  // settlements are visibly, not just silently, folded into today's totals.
  const todayJavakAdvanceTotal = todayTransactions
    .filter((t) => t.source === "JAVAK")
    .reduce((acc, t) => acc + (parseFloat(t.amount || 0) || 0), 0);
  const todayAavakInstallmentTotal = todayTransactions
    .filter((t) => t.source === "AAVAK_INSTALLMENT")
    .reduce((acc, t) => acc + (parseFloat(t.amount || 0) || 0), 0);

  const expectedClosingBalance = (parseFloat(openingBalance) || 0) + todayIn - todayOut;

  const handleCloseCounter = async () => {
    if (
      !window.confirm(
        `Are you sure you want to CLOSE the counter for today (${todayStr})? This will lock today's cash entries.`
      )
    )
      return;

    try {
      const docId = `Closure-${todayStr}`;
      await setDoc(doc(db, "dailyClosures", docId), {
        date: todayStr,
        openingBalance: parseFloat(String(openingBalance)) || 0,
        totalCashIn: parseFloat(String(todayIn)) || 0,
        totalCashOut: parseFloat(String(todayOut)) || 0,
        // Breakdown so it's clear Javak advances and older-bill Aavak
        // installment settlements were actually included in totalCashOut
        // above, not silently dropped.
        javakAdvancesToday: parseFloat(String(todayJavakAdvanceTotal)) || 0,
        aavakInstallmentsToday: parseFloat(String(todayAavakInstallmentTotal)) || 0,
        expectedClosingBalance: parseFloat(String(expectedClosingBalance)) || 0,
        closingBalance: parseFloat(String(expectedClosingBalance)) || 0,
        closedBy: currentUser?.name || "ADMIN",
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      setStatusMessage({ text: "Counter closed successfully!", type: "success" });
    } catch (error) {
      console.error("Error closing counter:", error);
      setStatusMessage({ text: "Error closing counter", type: "error" });
    }
  };

  const handleShareWhatsAppPDF = async () => {
    try {
      const doc = new jsPDF();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("VENKATESH COTTON COMPANY", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("CASH TRANSACTIONS REPORT - COUNTER DESK", 14, 26);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);
      doc.text(`Running Liquidity Balance: INR ${balance.toLocaleString()}`, 14, 36);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 40, 196, 40);

      const headers = [["Timestamp", "Type", "Details", "Reason / Description", "Amount (INR)"]];
      
      let tableRows = [];
      if (combinedTransactions.length === 0) {
        tableRows = [
          ["_______", "_______", "_______", "_______", "_______"]
        ];
      } else {
        tableRows = combinedTransactions.map((t) => {
          const timestampStr = t.timestamp?.toDate
            ? t.timestamp.toDate().toLocaleString()
            : (t.displayTimestamp || "_______");
          
          const typeStr = t.type === "IN" ? "IN" : "OUT";
          
          let detailsStr = "_______";
          if (t.type === "IN") {
            detailsStr = `FROM: ${t.source || "_______"}`;
          } else {
            detailsStr = `TO: ${t.recipient || t.personName || "_______"}`;
          }
          if (t.recordedBy) {
            detailsStr += ` (BY: ${t.recordedBy})`;
          }

          const reasonStr = t.reason || "_______";
          
          const amountFormatted = `${t.type === "IN" ? "+" : "-"} ${parseFloat(t.amount || 0).toLocaleString()}`;

          return [
            timestampStr,
            typeStr,
            detailsStr.toUpperCase(),
            reasonStr.toUpperCase(),
            amountFormatted
          ];
        });
      }

      autoTable(doc, {
        startY: 45,
        head: headers,
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [37, 211, 102],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {
          4: { halign: "right" }
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
      const cleanFileName = `Cash_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const file = new File([pdfBlob], cleanFileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Venkatesh Cotton Co - Cash Report",
          text: `Attached is the Cash Transactions Report generated on ${new Date().toLocaleDateString()}.`
        });
      } else {
        doc.save(cleanFileName);
      }
    } catch (error) {
      console.error("Error sharing or generating PDF:", error);
      try {
        const doc = new jsPDF();
        doc.text("Venkatesh Cotton Company - Cash Report", 14, 20);
        doc.save(`Cash_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (e) {
        console.error("Fallback save failed", e);
      }
    }
  };

  const isForecastToday = forecastDate === todayStr;

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <IndianRupee className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Denied</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Only Cashiers and Admins can access Cash Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
          Cash Management
        </h2>
        <div className="flex items-center gap-4 flex-wrap">
          {statusMessage.text && (
            <div
              className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                statusMessage.type === "success"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {statusMessage.text}
            </div>
          )}
          <button onClick={() => setIsFormOpen(!isFormOpen)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {isFormOpen ? "Close Form" : "Record Transaction"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
              <ArrowDownCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Total Cash In</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">₹{totalIn.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-800 rounded-lg">
              <ArrowUpCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Total Cash Out</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">₹{totalOut.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="card bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg">
              <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Current Balance</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">₹{balance.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-slate-100 uppercase tracking-tight">
            Record New Transaction
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Transaction Type</label>
              <select
                className="input-field font-bold uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="OUT">CASH OUT (PAYMENT/EXPENSE)</option>
                <option value="IN">CASH IN (FROM BANK/ADMIN)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Amount (₹)</label>
              <input
                type="number"
                className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            {type === "IN" ? (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Source (Select)</label>
                  <select
                    className="input-field font-bold uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    value={sourceSelect}
                    onChange={(e) => setSourceSelect(e.target.value)}
                  >
                    <option value="SBI">SBI</option>
                    <option value="Rajesh">RAJESH</option>
                    <option value="Other">OTHER</option>
                  </select>
                </div>
                {sourceSelect === "Other" && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      Custom Source Name
                    </label>
                    <input
                      type="text"
                      className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      placeholder="E.G. HDFC BANK, CASH DRAWER"
                      value={customSource}
                      onChange={(e) => setCustomSource(e.target.value)}
                      required
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Recipient (To)</label>
                <input
                  type="text"
                  className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  placeholder="E.G. FARMER NAME, STAFF"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>
            )}
            <div className="md:col-span-2 lg:col-span-3 space-y-1">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Reason / Description{" "}
                {type === "OUT" ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                )}
              </label>
              <input
                type="text"
                className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder={
                  type === "OUT"
                    ? "E.G. TRANSPORT WORKERS, OFFICE STATIONERY"
                    : "E.G. BANK WITHDRAWAL, LOAN REPAYMENT (OPTIONAL)"
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required={type === "OUT"}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsFormOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save Transaction
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                todayClosure
                  ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              {todayClosure ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                End of Day (EOD) Drawer Closure
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {todayClosure
                  ? `Counter for today (${todayStr}) is successfully locked.`
                  : `Daily counter balance verification for today (${todayStr}).`}
              </p>
            </div>
          </div>

          {!todayClosure && (
            <button
              onClick={handleCloseCounter}
              className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm"
            >
              <Lock className="w-4 h-4" />
              Close Counter for Today
            </button>
          )}
        </div>

        {todayClosure ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Opening Balance</span>
              <p className="text-base font-black text-slate-800 dark:text-slate-100">
                ₹{(todayClosure.openingBalance || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cash In</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                ₹{(todayClosure.totalCashIn || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cash Out</span>
              <p className="text-base font-black text-red-600 dark:text-red-400">
                ₹{(todayClosure.totalCashOut || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closing Balance</span>
              <p className="text-base font-black text-slate-800 dark:text-slate-100">
                ₹{(todayClosure.expectedClosingBalance || 0).toLocaleString()}
              </p>
            </div>
            <div className="col-span-2 md:col-span-1 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closed By</span>
              <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                {todayClosure.closedBy}
              </p>
              <p className="text-[9px] text-slate-400 uppercase truncate">
                {todayClosure.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Opening Balance <span className="text-emerald-500 font-extrabold">(Automated)</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">₹</span>
                <input
                  type="number"
                  className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 font-extrabold text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
                  value={openingBalance}
                  readOnly
                  placeholder="0"
                />
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Inflow</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 pt-1">
                ₹{todayIn.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Outflow</span>
              <p className="text-base font-black text-red-600 dark:text-red-400 pt-1">
                ₹{todayOut.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expected Close</span>
              <p className="text-base font-black text-slate-800 dark:text-slate-100 pt-1">
                ₹{expectedClosingBalance.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Breakdown so Javak advances and Aavak older-bill installment
            settlements are visibly folded into today's totals above, rather
            than silently summed with no trace. */}
        {(todayJavakAdvanceTotal > 0 || todayAavakInstallmentTotal > 0) && (
          <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/40">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Included: Javak Advances Today</span>
              <p className="text-base font-black text-amber-700 dark:text-amber-400 pt-1">
                ₹{todayJavakAdvanceTotal.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-sky-50 dark:bg-sky-950/20 rounded-lg border border-sky-100 dark:border-sky-900/40">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block">Included: Aavak Installments (Older Bills) Today</span>
              <p className="text-base font-black text-sky-700 dark:text-sky-400 pt-1">
                ₹{todayAavakInstallmentTotal.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
              Transaction History
            </h3>
          </div>
          <button
            onClick={handleShareWhatsAppPDF}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1ca34d] text-white text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
            title="Share complete cash log report via WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp Share
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Date & Time</th>
                <th className="px-6 py-4 font-bold">Type</th>
                <th className="px-6 py-4 font-bold">Details</th>
                <th className="px-6 py-4 font-bold">Reason</th>
                <th className="px-6 py-4 font-bold text-right">Amount</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {combinedTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                    {t.timestamp?.toDate ? t.timestamp.toDate().toLocaleString() : (t.displayTimestamp || "PENDING")}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                        t.type === "IN"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {t.type === "IN" ? "IN" : "OUT"}
                    </span>
                    {t.source === "JAVAK" && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Javak</span>
                    )}
                    {t.source === "AAVAK_INSTALLMENT" && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Aavak</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                      {t.type === "IN" ? `From: ${t.source}` : `To: ${t.recipient || t.personName || "N/A"}`}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                      By: {t.recordedBy}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 uppercase font-medium">
                    {t.reason}
                  </td>
                  <td
                    className={`px-6 py-4 text-sm font-black text-right ${
                      t.type === "IN" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "IN" ? "+" : "-"}₹
                    {(parseFloat(t.amount || t.amountPaid || 0) || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {t.isSynthetic ? (
                      <span className="text-[9px] text-slate-300 dark:text-slate-600 uppercase font-bold" title="Edit this from the Aavak installment log instead — it isn't a standalone cash entry.">
                        —
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-slate-300 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {combinedTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic text-sm">
                    No transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight font-mono">
              Maturity Forecast & Due Payments
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={forecastDate}
                onChange={(e) => setForecastDate(e.target.value)}
                className="input-field pl-9 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            {!isForecastToday && (
              <button
                onClick={() => setForecastDate(todayStr)}
                className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 cursor-pointer whitespace-nowrap"
              >
                Today
              </button>
            )}
            <span className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider font-mono whitespace-nowrap">
              {forecastDate}
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[250px] overflow-y-auto">
          {maturedEntries.length > 0 ? (
            maturedEntries.map((entry) => {
              const netValue = parseFloat(entry.netAmount || 0);
              const paidValue = parseFloat(entry.amountPaid || 0);
              const balanceLeft = Math.max(0, netValue - paidValue);
              return (
                <div
                  key={entry.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex justify-between items-center gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">
                        #{entry.tokenNo}
                      </span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-1.5 py-0.5 rounded uppercase">
                        {entry.paymentMode || "N/A"}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase mt-1">
                      {entry.Name || entry.farmerName || "UNKNOWN"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                      Village: {entry.Village || "N/A"} • Phone: {entry.farmerPhone || "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white font-mono">
                      INR {netValue.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs font-bold text-red-500 dark:text-red-400 font-mono">
                      Bal: INR {balanceLeft.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-slate-400 dark:text-slate-500 text-sm italic text-center py-8">
              No payments maturing on {forecastDate}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}