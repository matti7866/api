import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import residenceService from '../../services/residenceService';

export default function PrintLetter() {
  const [searchParams] = useSearchParams();
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadLetter = async () => {
      try {
        const id = searchParams.get('id');
        const type = searchParams.get('type') as 'noc' | 'salary_certificate';
        const bankId = searchParams.get('bank_id');

        if (!id || !type) {
          setError('Missing required parameters: id and type');
          setLoading(false);
          return;
        }

        const residenceId = parseInt(id);
        const bankIdNum = bankId ? parseInt(bankId) : undefined;

        const response = await residenceService.generateLetter(residenceId, type, bankIdNum);
        
        if (response && response.html) {
          setHtml(response.html);
        } else {
          setError('Failed to generate letter');
        }
      } catch (err: any) {
        console.error('Error loading letter:', err);
        setError(err.response?.data?.message || 'Failed to load letter');
      } finally {
        setLoading(false);
      }
    };

    loadLetter();
  }, [searchParams]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div>Loading letter...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}


