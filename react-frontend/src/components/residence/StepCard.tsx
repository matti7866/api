import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import Button from '../common/Button';
import residenceService from '../../services/residenceService';

interface StepCardProps {
  step: {
    number: number;
    title: string;
    icon: string;
    fields: Record<string, any>;
    fieldNames: Record<string, string>;
  };
  residence: Residence;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (step: number, data: Record<string, unknown>, markComplete: boolean) => Promise<boolean>;
  disabled?: boolean;
}

export default function StepCard({ step, residence, isExpanded, onToggle, onUpdate, disabled }: StepCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [lookups, setLookups] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [chargedEntities, setChargedEntities] = useState<any[]>([]);
  const [chargedON, setChargedON] = useState<number>(1); // 1 = Account, 2 = Supplier
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isCompleted = residence.completedStep >= step.number;
  const isActive = residence.completedStep === step.number - 1;
  const isLocked = residence.completedStep < step.number - 1;

  // Map step numbers to their field configurations (matching StepWorkflow numbering)
  const stepConfigs: Record<number, any> = {
    1: {
      // Step 1: Offer Letter (matches old PHP Step 2)
      fields: ['mb_number', 'salaryCur', 'company', 'offerLetterCost', 'offerLetterCostCur', 'offerLChargOpt', 'offerLChargedEntity'],
      chargedType: 'offerLetter',
      fileField: 'offerLetterFile',
      currencyType: 'offerLCostCur'
    },
    2: {
      // Step 2: Insurance (matches old PHP Step 3)
      fields: ['insuranceCost', 'insuranceCur', 'insuranceChargOpt', 'insuranceChargedEntity'],
      chargedType: 'insurance',
      fileField: 'insuranceFile',
      currencyType: 'insuranceCur'
    },
    3: {
      // Step 3: Labor Card (matches old PHP Step 4)
      fields: ['labor_card_id', 'labour_card_fee', 'laborCardCur', 'lrbChargOpt', 'lbrChargedEntity'],
      chargedType: 'LaborCard',
      fileField: 'laborCardFile',
      currencyType: 'laborCardFeeCur'
    },
    4: {
      // Step 4: E-Visa (matches old PHP Step 5)
      fields: ['evisa_cost', 'eVisaCostCur', 'eVisaTChargOpt', 'eVisaTChargedEntity'],
      chargedType: 'EVisaTyping',
      fileField: 'eVisaFile',
      currencyType: 'EvisaTying'
    },
    5: {
      // Step 5: Change Status (matches old PHP Step 6)
      fields: ['changeStatusCost', 'changeStatusCur', 'changeSChargOpt', 'changeSChargedEntity'],
      chargedType: 'changeStatus',
      fileField: 'changeStatusFile',
      currencyType: 'changeStatus'
    },
    6: {
      // Step 6: Medical (matches old PHP Step 7)
      fields: ['medical_cost', 'medicalCostCur', 'medicalTChargOpt', 'medicalTChargedEntity'],
      chargedType: 'medicalTyping',
      fileField: 'medicalFile',
      currencyType: 'medicalTyping'
    },
    7: {
      // Step 7: Emirates ID (matches old PHP Step 8)
      fields: ['emiratesIDCost', 'emiratesIDCostCur', 'emirateIDChargOpt', 'emiratesIDChargedEntity'],
      chargedType: 'emiratesIDTyping',
      fileField: 'emiratesIDFile',
      currencyType: 'emiratesIDTyping'
    },
    8: {
      // Step 8: Visa Stamping (matches old PHP Step 9)
      fields: ['visaStampingCost', 'visaStampingCur', 'expiry_date', 'laborCardNumber', 'visaStampChargOpt', 'visaStampChargedEntity'],
      chargedType: 'visaStamping',
      fileField: 'visaStampingFile',
      currencyType: 'visaStamping'
    },
    9: {
      // Step 9: Contract Submission (matches old PHP Step 10)
      fields: ['emiratesIDNumber'],
      chargedType: null,
      fileField: 'contractSubmissionFile',
      currencyType: null
    }
  };

  const stepConfig = stepConfigs[step.number];

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (lookups && stepConfig) {
      // Load currencies when lookups are ready
      if (lookups.currencies && currencies.length === 0) {
        setCurrencies(lookups.currencies);
      }
      // Load charged entities from lookups immediately as fallback
      if (stepConfig.chargedType) {
        if (chargedON === 1 && lookups.accounts && chargedEntities.length === 0) {
          console.log('Loading accounts from lookups immediately:', lookups.accounts);
          setChargedEntities(lookups.accounts);
        } else if (chargedON === 2 && lookups.suppliers && chargedEntities.length === 0) {
          console.log('Loading suppliers from lookups immediately:', lookups.suppliers);
          setChargedEntities(lookups.suppliers);
        }
        // Also try to load from API to get selected values
        loadChargedEntities().catch((err) => {
          console.log('API load failed, using lookups:', err);
        });
      }
    }
  }, [lookups, stepConfig, chargedON]);

  useEffect(() => {
    if (stepConfig) {
      loadCurrencies();
      if (stepConfig.chargedType) {
        loadChargedEntities();
      }
    }
  }, [step.number, residence.residenceID, stepConfig]);

  useEffect(() => {
    // Initialize form data with current values
    const initialData: Record<string, any> = {};
    
    // Map step-specific fields
    if (stepConfig) {
      stepConfig.fields.forEach((field: string) => {
        // Map field names to database fields
        const dbFieldMap: Record<string, string> = {
          'mb_number': 'mb_number',
          'salaryCur': 'salaryCurID',
          'company': 'company',
          'offerLetterCost': 'offerLetterCost',
          'offerLetterCostCur': 'offerLetterCostCur',
          'offerLChargOpt': 'offerLChargOpt',
          'offerLChargedEntity': 'offerLChargedEntity',
          'insuranceCost': 'insuranceCost',
          'insuranceCur': 'insuranceCur',
          'insuranceChargOpt': 'insuranceChargOpt',
          'insuranceChargedEntity': 'insuranceChargedEntity',
          'labor_card_id': 'laborCardID',
          'labour_card_fee': 'laborCardFee',
          'laborCardCur': 'laborCardCur',
          'lrbChargOpt': 'lrbChargOpt',
          'lbrChargedEntity': 'lbrChargedEntity',
          'evisa_cost': 'eVisaCost',
          'eVisaCostCur': 'eVisaCur',
          'eVisaTChargOpt': 'eVisaTChargOpt',
          'eVisaTChargedEntity': 'eVisaTChargedEntity',
          'changeStatusCost': 'changeStatusCost',
          'changeStatusCur': 'changeStatusCur',
          'changeSChargOpt': 'changeSChargOpt',
          'changeSChargedEntity': 'changeSChargedEntity',
          'medical_cost': 'medicalTCost',
          'medicalCostCur': 'medicalTCur',
          'medicalTChargOpt': 'medicalTChargOpt',
          'medicalTChargedEntity': 'medicalTChargedEntity',
          'emiratesIDCost': 'emiratesIDCost',
          'emiratesIDCostCur': 'emiratesIDCur',
          'emirateIDChargOpt': 'emirateIDChargOpt',
          'emiratesIDChargedEntity': 'emiratesIDChargedEntity',
          'visaStampingCost': 'visaStampingCost',
          'visaStampingCur': 'visaStampingCur',
          'expiry_date': 'expiry_date',
          'laborCardNumber': 'LabourCardNumber',
          'visaStampChargOpt': 'visaStampChargOpt',
          'visaStampChargedEntity': 'visaStampChargedEntity',
          'emiratesIDNumber': 'EmiratesIDNumber'
        };
        
        const dbField = dbFieldMap[field] || field;
        const value = (residence as any)[dbField];
        if (value !== undefined && value !== null) {
          initialData[field] = value;
        }
      });
      
      // Set Charged ON based on existing data
      if (stepConfig.chargedType) {
        const chargedOptField = stepConfig.fields.find((f: string) => f.includes('ChargOpt'));
        if (chargedOptField) {
          // Check if supplier field exists and has value
          const supplierFieldMap: Record<string, string> = {
            'offerLChargOpt': 'offerLetterSupplier',
            'insuranceChargOpt': 'insuranceSupplier',
            'lrbChargOpt': 'laborCardSupplier',
            'eVisaTChargOpt': 'eVisaSupplier',
            'changeSChargOpt': 'changeStatusSupplier',
            'medicalTChargOpt': 'medicalSupplier',
            'emirateIDChargOpt': 'emiratesIDSupplier',
            'visaStampChargOpt': 'visaStampingSupplier'
          };
          const supplierField = supplierFieldMap[chargedOptField];
          const hasSupplier = supplierField && (residence as any)[supplierField];
          const chargedONValue = hasSupplier ? 2 : 1;
          setChargedON(chargedONValue);
          initialData[chargedOptField] = chargedONValue;
        }
      }
    }
    
    setFormData(initialData);
  }, [step, residence]);

  const loadLookups = async () => {
    try {
      const data = await residenceService.getLookups();
      setLookups(data);
      // Also load currencies from lookups as fallback
      if (data?.currencies) {
        setCurrencies(data.currencies);
      }
    } catch (err) {
      console.error('Error loading lookups:', err);
    }
  };

  const loadCurrencies = async () => {
    try {
      if (stepConfig?.currencyType) {
        const response = await residenceService.getCurrencies(stepConfig.currencyType, residence.residenceID);
        // Handle different response formats
        let data = response;
        if (response && typeof response === 'object' && 'data' in response) {
          data = response.data;
        }
        if (Array.isArray(data)) {
          setCurrencies(data);
        } else if (data && Array.isArray(data.currencies)) {
          setCurrencies(data.currencies);
        } else {
          // Fallback: get currencies from lookups
          if (lookups?.currencies) {
            setCurrencies(lookups.currencies);
          } else {
            console.warn('No currencies found in response:', response);
            setCurrencies([]);
          }
        }
      } else {
        // If no currencyType, use currencies from lookups
        if (lookups?.currencies) {
          setCurrencies(lookups.currencies);
        }
      }
    } catch (err) {
      console.error('Error loading currencies:', err);
      // Fallback to lookups currencies
      if (lookups?.currencies) {
        setCurrencies(lookups.currencies);
      }
    }
  };

  const loadChargedEntities = async (newChargedON?: number) => {
    if (!stepConfig?.chargedType) return;
    
    try {
      const chargedONValue = newChargedON !== undefined ? newChargedON : chargedON;
      const response = await residenceService.getChargedEntity(
        residence.residenceID,
        stepConfig.chargedType,
        'load',
        chargedONValue
      );
      
      console.log('Charged entities response:', response); // Debug log
      
      // Handle different response formats
      let data = response;
      if (response && typeof response === 'object' && 'data' in response) {
        data = response.data;
      }
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('Setting charged entities:', data); // Debug log
        setChargedEntities(data);
      } else {
        // Fallback: use lookups
        console.log('Using fallback from lookups, chargedON:', chargedONValue); // Debug log
        if (chargedONValue === 1 && lookups?.accounts) {
          console.log('Loading accounts from lookups:', lookups.accounts); // Debug log
          setChargedEntities(lookups.accounts);
        } else if (chargedONValue === 2 && lookups?.suppliers) {
          console.log('Loading suppliers from lookups:', lookups.suppliers); // Debug log
          setChargedEntities(lookups.suppliers);
        } else {
          console.warn('No charged entities found in response:', response);
          console.warn('Lookups available:', { accounts: lookups?.accounts, suppliers: lookups?.suppliers });
          setChargedEntities([]);
        }
      }
    } catch (err) {
      console.error('Error loading charged entities:', err);
      // Fallback to lookups
      const chargedONValue = newChargedON !== undefined ? newChargedON : chargedON;
      if (chargedONValue === 1 && lookups?.accounts) {
        setChargedEntities(lookups.accounts);
      } else if (chargedONValue === 2 && lookups?.suppliers) {
        setChargedEntities(lookups.suppliers);
      }
    }
  };

  const handleChargedONChange = (value: number) => {
    setChargedON(value);
    const chargedOptField = stepConfig.fields.find((f: string) => f.includes('ChargOpt'));
    if (chargedOptField) {
      setFormData({ ...formData, [chargedOptField]: value, [stepConfig.fields.find((f: string) => f.includes('ChargedEntity')) || '']: '' });
    }
    loadChargedEntities(value);
  };

  const handleSave = async (markComplete: boolean = false) => {
    setSaving(true);
    try {
      const updateData: any = {
        step: step.number,
        markComplete
      };

      // Add all form fields
      Object.keys(formData).forEach(key => {
        updateData[key] = formData[key];
      });

      // Add file if selected
      if (selectedFile && stepConfig?.fileField) {
        updateData.files = { [stepConfig.fileField]: selectedFile };
      }

      const success = await onUpdate(step.number, updateData, markComplete);
      if (success) {
        setIsEditing(false);
        setSelectedFile(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return `AED ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getStatusColor = () => {
    if (isCompleted) return 'bg-green-600';
    if (isActive) return 'bg-blue-600';
    if (isLocked) return 'bg-gray-600';
    return 'bg-gray-600';
  };

  const getStatusIcon = () => {
    if (isCompleted) return 'fa-check-circle';
    if (isActive) return 'fa-clock';
    return 'fa-lock';
  };

  const renderField = (fieldName: string, label: string, type: string = 'text') => {
    const value = formData[fieldName] || '';
    
    if (type === 'select') {
      return (
        <select
          className="form-select w-full"
          style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
          value={value}
          onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
        >
          <option value="">--Select {label}--</option>
          {/* Options will be populated based on field */}
        </select>
      );
    }
    
    if (type === 'number') {
      return (
        <input
          type="number"
          className="form-control w-full"
          style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
          value={value}
          onChange={(e) => setFormData({ ...formData, [fieldName]: parseFloat(e.target.value) || 0 })}
        />
      );
    }
    
    if (type === 'date') {
      return (
        <input
          type="date"
          className="form-control w-full"
          style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
          value={value}
          onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
        />
      );
    }
    
    return (
      <input
        type="text"
        className="form-control w-full"
        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
        value={value}
        onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
      />
    );
  };

  return (
    <div className={`card step-card overflow-hidden border-l-4 ${isCompleted ? 'border-green-600' : isActive ? 'border-blue-600' : 'border-gray-600'}`} style={{ backgroundColor: '#2d353c', borderColor: isCompleted ? '#16a34a' : isActive ? '#2563eb' : '#6b7280' }}>
      {/* Header */}
      <div
        className={`p-4 cursor-pointer hover:bg-gray-700/50 transition-colors ${disabled ? 'opacity-60' : ''}`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${getStatusColor()} flex items-center justify-center text-white`}>
              <i className={`fa ${getStatusIcon()}`}></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <i className={`fa ${step.icon}`}></i>
                Step {step.number}: {step.title}
              </h3>
              <p className="text-sm text-gray-400">
                {isCompleted && 'Completed'}
                {isActive && 'Ready to process'}
                {isLocked && 'Locked - complete previous steps first'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {step.fields.cost && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Cost</div>
                <div className="text-white font-bold">{formatCurrency(step.fields.cost)}</div>
              </div>
            )}
            {step.fields.date && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Date</div>
                <div className="text-white">{formatDate(step.fields.date)}</div>
              </div>
            )}
            <i className={`fa ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400`}></i>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4" style={{ backgroundColor: '#1a1d23' }}>
          {!isEditing ? (
            /* View Mode */
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {step.fields.cost !== undefined && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cost</label>
                    <div className="text-white">{formatCurrency(step.fields.cost)}</div>
                  </div>
                )}
                {step.fields.supplier && lookups && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Supplier</label>
                    <div className="text-white">
                      {lookups.suppliers?.find((s: any) => s.supplier_id === step.fields.supplier)?.supplier_name || '-'}
                    </div>
                  </div>
                )}
                {step.fields.account && lookups && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Account</label>
                    <div className="text-white">
                      {lookups.accounts?.find((a: any) => a.account_ID === step.fields.account)?.account_Name || '-'}
                    </div>
                  </div>
                )}
                {step.fields.status && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Status</label>
                    <div className="text-white capitalize">{step.fields.status}</div>
                  </div>
                )}
                {step.fields.date && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Date</label>
                    <div className="text-white">{formatDate(step.fields.date)}</div>
                  </div>
                )}
                
                {/* Step-specific fields */}
                {step.fields.mb_number && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">MB Number</label>
                    <div className="text-white">{step.fields.mb_number}</div>
                  </div>
                )}
                {step.fields.laborCardID && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Labor Card ID</label>
                    <div className="text-white">{step.fields.laborCardID}</div>
                  </div>
                )}
                {step.fields.emiratesIDNumber && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Emirates ID Number</label>
                    <div className="text-white">{step.fields.emiratesIDNumber}</div>
                  </div>
                )}
                {step.fields.laborCardNumber && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Labour Card Number</label>
                    <div className="text-white">{step.fields.laborCardNumber}</div>
                  </div>
                )}
                {step.fields.expiryDate && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Visa Expiry Date</label>
                    <div className="text-white">{formatDate(step.fields.expiryDate)}</div>
                  </div>
                )}
              </div>

              {!disabled && !isLocked && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setIsEditing(true)}>
                    <i className="fa fa-edit mr-2"></i>
                    {isCompleted ? 'Edit Step' : 'Process Step'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Edit Mode */
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Step 1: Offer Letter */}
                {step.number === 1 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">MB Number</label>
                      {renderField('mb_number', 'MB Number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency (Salary)</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.salaryCur || ''}
                        onChange={(e) => setFormData({ ...formData, salaryCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Establishment</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.company || ''}
                        onChange={(e) => setFormData({ ...formData, company: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Establishment</option>
                        {lookups?.companies?.map((c: any) => (
                          <option key={c.company_id} value={c.company_id}>{c.company_name || c.username}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Offer Letter Cost</label>
                      {renderField('offerLetterCost', 'Offer Letter Cost', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.offerLetterCostCur || ''}
                        onChange={(e) => setFormData({ ...formData, offerLetterCostCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.offerLChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.offerLChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, offerLChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 2: Insurance */}
                {step.number === 2 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Insurance Cost</label>
                      {renderField('insuranceCost', 'Insurance Cost', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.insuranceCur || ''}
                        onChange={(e) => setFormData({ ...formData, insuranceCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.insuranceChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.insuranceChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, insuranceChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 3: Labor Card */}
                {step.number === 3 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Labor Card ID</label>
                      {renderField('labor_card_id', 'Labor Card ID')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Labour Card Fee</label>
                      {renderField('labour_card_fee', 'Labour Card Fee', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.laborCardCur || ''}
                        onChange={(e) => setFormData({ ...formData, laborCardCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.lrbChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.lbrChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, lbrChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 4: E-Visa */}
                {step.number === 4 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">E-Visa Cost</label>
                      {renderField('evisa_cost', 'E-Visa Cost', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.eVisaCostCur || ''}
                        onChange={(e) => setFormData({ ...formData, eVisaCostCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.eVisaTChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.eVisaTChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, eVisaTChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 5: Change Status */}
                {step.number === 5 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Change Status Cost</label>
                      {renderField('changeStatusCost', 'Change Status Cost', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.changeStatusCur || ''}
                        onChange={(e) => setFormData({ ...formData, changeStatusCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.changeSChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.changeSChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, changeSChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 6: Medical */}
                {step.number === 6 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Medical Cost</label>
                      {renderField('medical_cost', 'Medical Cost', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.medicalCostCur || ''}
                        onChange={(e) => setFormData({ ...formData, medicalCostCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.medicalTChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.medicalTChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, medicalTChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 7: Emirates ID */}
                {step.number === 7 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Emirates ID Cost</label>
                      {renderField('emiratesIDCost', 'Emirates ID Cost', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.emiratesIDCostCur || ''}
                        onChange={(e) => setFormData({ ...formData, emiratesIDCostCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.emirateIDChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.emiratesIDChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, emiratesIDChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 8: Visa Stamping */}
                {step.number === 8 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Visa Stamping Cost</label>
                      {renderField('visaStampingCost', 'Visa Stamping Cost', 'number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Currency</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.visaStampingCur || ''}
                        onChange={(e) => setFormData({ ...formData, visaStampingCur: parseInt(e.target.value) || null })}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Expiry Date</label>
                      {renderField('expiry_date', 'Expiry Date', 'date')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Labor Card Number</label>
                      {renderField('laborCardNumber', 'Labor Card Number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged ON</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.visaStampChargOpt || chargedON}
                        onChange={(e) => handleChargedONChange(parseInt(e.target.value))}
                      >
                        <option value="1">Account</option>
                        <option value="2">Supplier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Charged Entity</label>
                      <select
                        className="form-select w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        value={formData.visaStampChargedEntity || ''}
                        onChange={(e) => setFormData({ ...formData, visaStampChargedEntity: parseInt(e.target.value) || null })}
                      >
                        <option value="">--Select {chargedON === 1 ? 'Account' : 'Supplier'}--</option>
                        {chargedEntities.map((entity: any) => (
                          <option key={chargedON === 1 ? entity.account_ID : entity.supp_id} 
                                  value={chargedON === 1 ? entity.account_ID : entity.supp_id}>
                            {chargedON === 1 ? entity.account_Name : entity.supp_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}

                {/* Step 9: Contract Submission */}
                {step.number === 9 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Emirates ID Number</label>
                      {renderField('emiratesIDNumber', 'Emirates ID Number')}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Attachment</label>
                      <input
                        type="file"
                        className="form-control w-full"
                        style={{ backgroundColor: '#ffffff', color: '#2d353c', border: '1px solid #d1d5db' }}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  <i className="fa fa-save mr-2"></i>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {!isCompleted && (
                  <Button
                    variant="success"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                  >
                    <i className="fa fa-check mr-2"></i>
                    {saving ? 'Saving...' : 'Save & Mark Complete'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedFile(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
