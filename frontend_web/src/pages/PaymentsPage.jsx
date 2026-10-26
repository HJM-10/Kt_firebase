import { useState, useEffect } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

const PaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchPayments = async () => {
    try {
      const res = await axios.get('/payments');
      if (res.data.success) {
        setPayments(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const totalPages = Math.ceil(payments.length / itemsPerPage);
  const paginatedPayments = payments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div className="p-6 text-white text-center">Loading payments...</div>;

  return (
    <div className="p-6 text-white h-full overflow-auto">
      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400 mb-8">
        Payments
      </h1>

      <div className="card overflow-hidden flex flex-col" style={{ padding: 0 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-white/5 text-gray-400 border-b border-white/10">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Purpose</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedPayments.map(payment => (
              <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 text-gray-500">#{payment.id}</td>
                <td className="px-6 py-4">{new Date(payment.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-white">{payment.user?.name}</div>
                  <div className="text-xs text-gray-500">{payment.user?.email}</div>
                </td>
                <td className="px-6 py-4 text-blue-400 font-medium">{payment.purpose.replace(/_/g, ' ')}</td>
                <td className="px-6 py-4 font-bold text-emerald-400">Rs. {payment.amount}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    payment.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                    payment.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {payment.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No payments found.</div>
        ) : (
          <div className="flex justify-between items-center p-4 border-t border-white/10 bg-white/5">
            <span className="text-sm text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, payments.length)} of {payments.length} entries
            </span>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="btn btn-secondary"
              >
                Previous
              </button>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="btn btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsPage;
