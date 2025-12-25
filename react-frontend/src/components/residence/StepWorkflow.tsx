import { useState } from 'react';
import type { Residence } from '../../types/residence';
import StepCard from './StepCard';

interface StepWorkflowProps {
  residence: Residence;
  onStepUpdate: (step: number, data: Record<string, unknown>, markComplete: boolean) => Promise<boolean>;
  disabled?: boolean;
}

export default function StepWorkflow({ residence, onStepUpdate, disabled }: StepWorkflowProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(residence.completedStep + 1);

  const steps = [
    {
      number: 1,
      title: 'Offer Letter',
      icon: 'fa-file-contract',
      fields: {
        cost: residence.offerLetterCost,
        currency: residence.offerLetterCostCur,
        supplier: residence.offerLetterSupplier,
        account: residence.offerLetterAccount,
        status: residence.offerLetterStatus,
        date: residence.offerLetterDate,
      },
      fieldNames: {
        cost: 'offerLetterCost',
        currency: 'offerLetterCostCur',
        supplier: 'offerLetterSupplier',
        account: 'offerLetterAccount',
        status: 'offerLetterStatus',
        date: 'offerLetterDate',
      }
    },
    {
      number: 2,
      title: 'Insurance',
      icon: 'fa-shield-alt',
      fields: {
        cost: residence.insuranceCost,
        currency: residence.insuranceCur,
        supplier: residence.insuranceSupplier,
        account: residence.insuranceAccount,
        date: residence.insuranceDate,
      },
      fieldNames: {
        cost: 'insuranceCost',
        currency: 'insuranceCur',
        supplier: 'insuranceSupplier',
        account: 'insuranceAccount',
        date: 'insuranceDate',
      }
    },
    {
      number: 3,
      title: 'Labor Card',
      icon: 'fa-id-card',
      fields: {
        mb_number: residence.mb_number,
        laborCardID: residence.laborCardID,
        cost: residence.laborCardFee,
        currency: residence.laborCardCur,
        supplier: residence.laborCardSupplier,
        account: residence.laborCardAccount,
        date: residence.laborCardDate,
      },
      fieldNames: {
        mb_number: 'mb_number',
        laborCardID: 'laborCardID',
        cost: 'laborCardFee',
        currency: 'laborCardCur',
        supplier: 'laborCardSupplier',
        account: 'laborCardAccount',
        date: 'laborCardDate',
      }
    },
    {
      number: 4,
      title: 'E-Visa',
      icon: 'fa-passport',
      fields: {
        cost: residence.eVisaCost,
        currency: residence.eVisaCur,
        supplier: residence.eVisaSupplier,
        account: residence.eVisaAccount,
        status: residence.eVisaStatus,
        date: residence.eVisaDate,
      },
      fieldNames: {
        cost: 'eVisaCost',
        currency: 'eVisaCur',
        supplier: 'eVisaSupplier',
        account: 'eVisaAccount',
        status: 'eVisaStatus',
        date: 'eVisaDate',
      }
    },
    {
      number: 5,
      title: 'Change Status',
      icon: 'fa-exchange-alt',
      fields: {
        cost: residence.changeStatusCost,
        currency: residence.changeStatusCur,
        supplier: residence.changeStatusSupplier,
        account: residence.changeStatusAccount,
        date: residence.changeStatusDate,
      },
      fieldNames: {
        cost: 'changeStatusCost',
        currency: 'changeStatusCur',
        supplier: 'changeStatusSupplier',
        account: 'changeStatusAccount',
        date: 'changeStatusDate',
      }
    },
    {
      number: 6,
      title: 'Medical Test',
      icon: 'fa-heartbeat',
      fields: {
        cost: residence.medicalTCost,
        currency: residence.medicalTCur,
        supplier: residence.medicalSupplier,
        account: residence.medicalAccount,
        date: residence.medicalDate,
      },
      fieldNames: {
        cost: 'medicalTCost',
        currency: 'medicalTCur',
        supplier: 'medicalSupplier',
        account: 'medicalAccount',
        date: 'medicalDate',
      }
    },
    {
      number: 7,
      title: 'Emirates ID',
      icon: 'fa-id-badge',
      fields: {
        cost: residence.emiratesIDCost,
        currency: residence.emiratesIDCur,
        supplier: residence.emiratesIDSupplier,
        account: residence.emiratesIDAccount,
        emiratesIDNumber: residence.EmiratesIDNumber,
        date: residence.emiratesIDDate,
      },
      fieldNames: {
        cost: 'emiratesIDCost',
        currency: 'emiratesIDCur',
        supplier: 'emiratesIDSupplier',
        account: 'emiratesIDAccount',
        emiratesIDNumber: 'EmiratesIDNumber',
        date: 'emiratesIDDate',
      }
    },
    {
      number: 8,
      title: 'Visa Stamping',
      icon: 'fa-stamp',
      fields: {
        cost: residence.visaStampingCost,
        currency: residence.visaStampingCur,
        supplier: residence.visaStampingSupplier,
        account: residence.visaStampingAccount,
        laborCardNumber: residence.LabourCardNumber,
        expiryDate: residence.expiry_date,
      },
      fieldNames: {
        cost: 'visaStampingCost',
        currency: 'visaStampingCur',
        supplier: 'visaStampingSupplier',
        account: 'visaStampingAccount',
        laborCardNumber: 'LabourCardNumber',
        expiryDate: 'expiry_date',
      }
    },
    {
      number: 9,
      title: 'EID Received',
      icon: 'fa-inbox',
      fields: {
        received: residence.eid_received,
        receiveDate: residence.eid_received_date,
        expiry: residence.eid_expiry,
      },
      fieldNames: {
        received: 'eid_received',
        receiveDate: 'eid_received_date',
        expiry: 'eid_expiry',
      }
    },
    {
      number: 10,
      title: 'EID Delivered',
      icon: 'fa-check-circle',
      fields: {
        delivered: residence.eid_delivered,
        deliveredDate: residence.eid_delivered_datetime,
      },
      fieldNames: {
        delivered: 'eid_delivered',
        deliveredDate: 'eid_delivered_datetime',
      }
    },
  ];

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm" style={{ color: '#9ca3af' }}>Overall Progress</span>
          <span className="text-sm font-bold" style={{ color: '#ffffff' }}>
            {Math.round((residence.completedStep / 10) * 100)}%
          </span>
        </div>
        <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: '#374151' }}>
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{ 
              width: `${(residence.completedStep / 10) * 100}%`,
              background: 'linear-gradient(to right, #dc2626, #991b1b)'
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs" style={{ color: '#6b7280' }}>
          <span>Not Started</span>
          <span>In Progress</span>
          <span>Completed</span>
        </div>
      </div>

      {/* Steps */}
      {steps.map((step) => (
        <StepCard
          key={step.number}
          step={step}
          residence={residence}
          isExpanded={expandedStep === step.number}
          onToggle={() => setExpandedStep(expandedStep === step.number ? null : step.number)}
          onUpdate={onStepUpdate}
          disabled={disabled}
        />
      ))}
    </div>
  );
}






