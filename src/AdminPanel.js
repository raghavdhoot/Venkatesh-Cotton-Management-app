import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, doc, addDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Save, Trash2, Plus, MessageSquare, IndianRupee, Shield } from 'lucide-react';

function AdminPanel({ currentUser }) {
    const [note, setNote] = useState('');
    const [adminNotes, setAdminNotes] = useState([]);
    const [itemName, setItemName] = useState('');
    const [itemRate, setItemRate] = useState('');
    const [rateChart, setRateChart] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    const isAdmin = currentUser?.role === 'admin' || currentUser?.employeeId === 'ADMIN';

    useEffect(() => {
        if (!isAdmin) return;

        const unsubscribeNotes = onSnapshot(query(collection(db, 'adminNotes'), orderBy('timestamp', 'desc')), (snapshot) => {
            setAdminNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeRates = onSnapshot(query(collection(db, 'rateChart'), orderBy('timestamp', 'desc')), (snapshot) => {
            setRateChart(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeNotes();
            unsubscribeRates();
        };
    }, [isAdmin]);

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        try {
            await addDoc(collection(db, 'adminNotes'), {
                content: note.toUpperCase(),
                author: currentUser.name,
                timestamp: serverTimestamp()
            });
            setNote('');
            setStatusMessage({ text: 'Note added successfully', type: 'success' });
        } catch (error) {
            console.error("Error adding note:", error);
            setStatusMessage({ text: 'Error adding note', type: 'error' });
        }
    };

    const handleAddRate = async (e) => {
        e.preventDefault();
        if (!itemName.trim() || !itemRate) return;
        try {
            await addDoc(collection(db, 'rateChart'), {
                itemName: itemName.toUpperCase(),
                rate: parseFloat(itemRate),
                timestamp: serverTimestamp()
            });
            setItemName('');
            setItemRate('');
            setStatusMessage({ text: 'Rate added successfully', type: 'success' });
        } catch (error) {
            console.error("Error adding rate:", error);
            setStatusMessage({ text: 'Error adding rate', type: 'error' });
        }
    };

    const handleDelete = async (coll, id) => {
        try {
            await deleteDoc(doc(db, coll, id));
            setStatusMessage({ text: 'Deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting:", error);
            setStatusMessage({ text: 'Error deleting', type: 'error' });
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <Shield className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
                    <p className="text-slate-500">Only administrators can access this panel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Admin Control Panel</h2>
                {statusMessage.text && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                        statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {statusMessage.text}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Notes Management */}
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-indigo-600" />
                            Manage Dashboard Notes
                        </h3>
                        <form onSubmit={handleAddNote} className="space-y-4">
                            <textarea 
                                className="input-field min-h-[100px] uppercase" 
                                placeholder="WRITE CHANGES OR NOTES HERE..."
                                value={note}
                                onChange={(e) => setNote(e.target.value.toUpperCase())}
                                required
                            />
                            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Post Note
                            </button>
                        </form>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h4 className="font-bold text-slate-700">Recent Notes</h4>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                            {adminNotes.map(n => (
                                <div key={n.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-900 font-medium whitespace-pre-wrap">{n.content}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 uppercase">By {n.author} • {n.timestamp?.toDate().toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => handleDelete('adminNotes', n.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Rate Chart Management */}
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <IndianRupee className="w-5 h-5 text-emerald-600" />
                            Manage Rate Chart
                        </h3>
                        <form onSubmit={handleAddRate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Item Name</label>
                                <input 
                                    type="text" 
                                    className="input-field uppercase" 
                                    placeholder="E.G., COTTON"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Rate (₹)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="input-field" 
                                    placeholder="0.00"
                                    value={itemRate}
                                    onChange={(e) => setItemRate(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="sm:col-span-2 btn-primary flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> Save to Rate Chart
                            </button>
                        </form>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                            <h4 className="font-bold text-slate-700">Current Rates</h4>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {rateChart.map(r => (
                                <div key={r.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="font-bold text-slate-900">{r.itemName}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">Updated: {r.timestamp?.toDate().toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-black text-emerald-600">₹{r.rate}</span>
                                        <button onClick={() => handleDelete('rateChart', r.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;
