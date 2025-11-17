import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../../services/api';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './EstablishmentEmployees.css';

interface Employee {
  residenceID: number;
  passenger_name: string;
  countryName: string;
  countryCode: string;
  LabourCardNumber: string;
  EmiratesIDNumber: string;
  expiry_date: string;
  completedStep: number;
  cancelled: number;
}

interface Company {
  company_id: number;
  company_name: string;
}

export default function EstablishmentEmployees() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadCompanyAndEmployees();
    }
  }, [id]);

  const loadCompanyAndEmployees = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('companyID', id);
      
      const response = await axios.post('/establishments/get-employees.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Employees API Response:', response.data);
      
      // Handle JWTHelper response format
      // JWTHelper::sendResponse(200, true, '...', ['company' => ..., 'employees' => ...])
      // When $data is an array, JWTHelper merges it: array_merge($response, $data)
      // So structure is: { success: true, message: "...", company: {...}, employees: [...] }
      
      if (response.data && response.data.success) {
        // Data is merged at top level of response.data
        const responseData = response.data;
        
        console.log('Parsed responseData:', responseData);
        console.log('Has company:', !!responseData.company);
        console.log('Has employees:', !!responseData.employees);
        console.log('Employees is array:', Array.isArray(responseData.employees));
        
        // Check for company and employees at top level
        if (responseData.company && Array.isArray(responseData.employees)) {
          setCompany(responseData.company);
          setEmployees(responseData.employees);
        } else if (responseData.company) {
          setCompany(responseData.company);
          setEmployees(responseData.employees || []);
        } else if (Array.isArray(responseData.employees)) {
          setEmployees(responseData.employees);
        } else if (responseData.data) {
          // Fallback: check if data is nested (shouldn't happen with array_merge)
          const nestedData = responseData.data;
          if (nestedData.company && Array.isArray(nestedData.employees)) {
            setCompany(nestedData.company);
            setEmployees(nestedData.employees);
          } else {
            console.error('Unexpected nested structure:', nestedData);
            Swal.fire('Error', 'Unexpected data structure. Check console for details.', 'error');
            navigate('/establishments');
            return;
          }
        } else {
          console.error('Unexpected response structure:', responseData);
          console.error('Available keys:', Object.keys(responseData));
          console.error('Full response:', JSON.stringify(responseData, null, 2));
          Swal.fire('Error', 'Unexpected data structure. Check console for details.', 'error');
          navigate('/establishments');
          return;
        }
      } else {
        console.error('API returned error:', response.data);
        Swal.fire('Error', response.data?.message || 'Failed to load employees', 'error');
        navigate('/establishments');
        return;
      }
    } catch (error: any) {
      console.error('Error loading employees:', error);
      console.error('Error response:', error.response?.data);
      Swal.fire('Error', error.response?.data?.message || error.message || 'Failed to load employees', 'error');
      navigate('/establishments');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEmployee = async (employeeID: number, employeeName: string) => {
    const result = await Swal.fire({
      title: 'Cancel Employee',
      text: `Are you sure you want to cancel ${employeeName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, cancel employee'
    });

    if (result.isConfirmed) {
      try {
        const formData = new FormData();
        formData.append('residenceID', employeeID.toString());
        
        const response = await axios.post('/establishments/cancel-employee.php', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (response.data.success) {
          Swal.fire('Success', 'Employee cancelled successfully', 'success');
          loadCompanyAndEmployees();
        } else {
          Swal.fire('Error', response.data.message || 'Failed to cancel employee', 'error');
        }
      } catch (error: any) {
        console.error('Error cancelling employee:', error);
        Swal.fire('Error', error.message || 'Failed to cancel employee', 'error');
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  const isExpired = (dateString: string) => {
    if (!dateString) return false;
    try {
      const expiryDate = new Date(dateString);
      const today = new Date();
      return expiryDate < today;
    } catch {
      return false;
    }
  };

  const getProgressBarColor = (completedStep: number) => {
    return completedStep === 10 ? 'bg-success' : 'bg-indigo';
  };

  const percentCompleted = (completedStep: number) => {
    return (completedStep / 10) * 100;
  };

  const handleExportPDF = () => {
    if (!company || employees.length === 0) {
      Swal.fire('Info', 'No employees to export', 'info');
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Set document properties
      doc.setFontSize(16);
      doc.text(`Establishment Employees - ${company.company_name}`, 14, 20);
      
      // Add date
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`, 14, 28);
      
      // Prepare table data
      const tableData = employees.map((emp) => {
        const progress = `${emp.completedStep} / 10`;
        const status = emp.cancelled === 1 ? 'Cancelled' : 'Active';
        
        return [
          emp.passenger_name || 'N/A',
          emp.countryName || 'N/A',
          emp.LabourCardNumber || 'n/a',
          emp.EmiratesIDNumber || 'n/a',
          formatDate(emp.expiry_date),
          status,
          progress
        ];
      });

      // Define table columns
      const columns = [
        'Name',
        'Nationality',
        'Labour Card #',
        'Emirates ID #',
        'Expiry Date',
        'Status',
        'Progress'
      ];

      // Add table to PDF
      autoTable(doc, {
        startY: 35,
        head: [columns],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 40 },  // Name
          1: { cellWidth: 30 },  // Nationality
          2: { cellWidth: 25 },  // Labour Card
          3: { cellWidth: 30 },  // Emirates ID
          4: { cellWidth: 25 },  // Expiry
          5: { cellWidth: 20 },  // Status
          6: { cellWidth: 20 }   // Progress
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });

      // Add footer with page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Page ${i} of ${pageCount} | Generated on: ${new Date().toLocaleString()}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      // Save the PDF
      const fileName = `employees_${company.company_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      Swal.fire('Error', error.message || 'Failed to generate PDF', 'error');
    }
  };

  return (
    <div className="establishment-employees-page">
      <div className="container-fluid">
        <div className="row mb-4">
          <div className="col-md-12">
            <button className="btn btn-secondary mb-3" onClick={() => navigate('/establishments')}>
              <i className="fa fa-arrow-left"></i> Back to Establishments
            </button>
            <h3>Establishment Employees {company && `(${company.company_name})`}</h3>
            <button className="btn btn-primary mb-2" onClick={handleExportPDF} disabled={!company || employees.length === 0}>
              <i className="fa fa-file-pdf"></i> Export to PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <i className="fa fa-spinner fa-spin fa-3x"></i>
            <p className="mt-3">Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="row">
            <div className="col-md-12 text-center text-danger">
              No employees found
            </div>
          </div>
        ) : (
          <div className="row">
            {employees.map((emp) => (
              <div key={emp.residenceID} className="col-md-6 mb-3">
                <div 
                  className="card" 
                  style={{ opacity: emp.cancelled === 1 ? 0.4 : 1 }}
                >
                  <div className="card-body">
                    <div className="media d-flex">
                      <img 
                        src="/color_admin_v5.0/admin/template/assets/img/user/user-13.jpg" 
                        className="me-3 rounded-circle" 
                        alt={emp.countryName} 
                        height="70"
                      />
                      <div className="media-body">
                        <h5 className="mb-1">{emp.passenger_name}</h5>
                        <p className="mb-1">
                          <img 
                            height="14" 
                            className="border" 
                            src={`https://flagpedia.net/data/flags/h24/${emp.countryCode?.toLowerCase()}.png`} 
                            alt={emp.countryName}
                          />{' '}
                          {emp.countryName}
                        </p>
                        {emp.cancelled === 1 && (
                          <span className="badge bg-danger mt-1">Cancelled</span>
                        )}
                      </div>
                    </div>
                    <div className="row mt-3">
                      <div className="col-md-3 mb-1">
                        <strong>Passport #</strong>
                        <br />n/a
                      </div>
                      <div className="col-md-3 mb-1">
                        <strong>Labour Card #</strong>
                        <br />{emp.LabourCardNumber || 'n/a'}
                      </div>
                      <div className="col-md-3 mb-1">
                        <strong>Emirates ID Number</strong>
                        <br />{emp.EmiratesIDNumber || 'n/a'}
                      </div>
                      <div className="col-md-3 mb-1">
                        <strong>Expiry Date</strong>
                        <br />
                        <span className={isExpired(emp.expiry_date) ? 'text-danger' : 'text-success'}>
                          {formatDate(emp.expiry_date)}
                        </span>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-md-12 mt-2">
                        <div className="progress rounded-pill">
                          <div 
                            className={`progress-bar ${getProgressBarColor(emp.completedStep)} progress-bar-striped ${
                              emp.completedStep !== 10 ? 'progress-bar-animated' : ''
                            } rounded-pill fs-10px fw-bold`}
                            style={{ width: `${percentCompleted(emp.completedStep)}%` }}
                          >
                            {emp.completedStep} / 10
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="row mt-4">
                      <div className="col-md-12">
                        {emp.cancelled !== 1 && (
                          <button 
                            className="btn btn-danger btn-cancel" 
                            onClick={() => handleCancelEmployee(emp.residenceID, emp.passenger_name)}
                          >
                            Cancel Employee
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

