import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { UserPlus, Trash2, User, Calendar, ShieldCheck } from 'lucide-react';

function Employees() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [joiningYear, setJoiningYear] = useState(new Date().getFullYear().toString());
    const [employees, setEmployees] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        if (statusMessage.text) {
            const timer = setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    useEffect(() => {
        const q = query(collection(db, 'employees'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const empData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setEmployees(empData);
        });
        return () => unsubscribe();
    }, []);

    const generateEmployeeId = (name, year) => {
        const prefix = name.substring(0, 4).toUpperCase().padEnd(4, 'X');
        const suffix = year.substring(year.length - 2);
        return `${prefix}${suffix}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim() || !joiningYear) {
            setStatusMessage({ text: 'Please provide both First Name and Last Name', type: 'error' });
            return;
        }

        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const empId = generateEmployeeId(fullName, joiningYear);
        
        const newEmployee = {
            name: fullName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            joiningYear: parseInt(joiningYear, 10),
            employeeId: empId,
            timestamp: serverTimestamp()
        };

        try {
            await setDoc(doc(db, 'employees', empId), newEmployee);
            setFirstName('');
            setLastName('');
            setJoiningYear(new Date().getFullYear().toString());
            setIsFormOpen(false);
            setStatusMessage({ text: `Employee registered! ID: ${empId}`, type: 'success' });
        } catch (error) {
            console.error("Error adding employee: ", error);
            setStatusMessage({ text: 'Error adding employee', type: 'error' });
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'employees', id));
            setDeleteConfirmId(null);
            setStatusMessage({ text: 'Employee deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting employee: ", error);
            setStatusMessage({ text: 'Error deleting employee', type: 'error' });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Employee Management</h2>
                <div className="flex items-center gap-4">
                    {statusMessage.text && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                            statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {statusMessage.text}
                        </div>
                    )}
                    <button 
                        onClick={() => setIsFormOpen(!isFormOpen)} 
                        className="btn-primary flex items-center gap-2"
                    >
                        {isFormOpen ? <ShieldCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        {isFormOpen ? 'Close Form' : 'Add New Employee'}
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">First Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10" 
                                    value={firstName} 
                                    onChange={(e) => setFirstName(e.target.value)} 
                                    required 
                                    placeholder="e.g., Shivanand"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Last Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10" 
                                    value={lastName} 
                                    onChange={(e) => setLastName(e.target.value)} 
                                    required 
                                    placeholder="e.g., Shinde"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Year of Joining</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="number" 
                                    className="input-field pl-10" 
                                    value={joiningYear} 
                                    onChange={(e) => setJoiningYear(e.target.value)} 
                                    required 
                                    min="2000" 
                                    max="2099"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button type="submit" className="btn-primary">Generate ID & Save</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card overflow-hidden !p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">Employee ID</th>
                                <th className="px-6 py-4 font-semibold">Name</th>
                                <th className="px-6 py-4 font-semibold">Joined</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-mono font-bold text-indigo-600">{emp.employeeId}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{emp.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{emp.joiningYear}</td>
                                    <td className="px-6 py-4 text-right">
                                        {deleteConfirmId === emp.id ? (
                                            <div className="flex justify-end gap-2 animate-in zoom-in-95 duration-200">
                                                <button 
                                                    onClick={() => handleDelete(emp.id)}
                                                    className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition-colors"
                                                >
                                                    Confirm
                                                </button>
                                                <button 
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-300 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setDeleteConfirmId(emp.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Employees;
