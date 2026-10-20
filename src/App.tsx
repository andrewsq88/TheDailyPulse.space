import { useState, useEffect } from 'react';
import { ExternalLink, Mail, Phone } from 'lucide-react';

interface Advertisement {
  id: string;
  type: 'product' | 'service';
  company_name: string;
  product_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  services_provided?: string;
  website_url?: string;
}

function App() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApprovedAds = async () => {
      try {
        const response = await fetch('/.netlify/functions/forms?action=list-ads');
        if (!response.ok) throw new Error('Failed to load advertisements');
        const payload = await response.json();
        setAds(Array.isArray(payload.ads) ? payload.ads : []);
      } catch (error) {
        console.error('Error fetching ads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovedAds();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Featured Advertisements</h1>
          <p className="text-lg text-slate-600">Discover products and services from our partners</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-600">Loading advertisements...</div>
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600">No advertisements available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ads.map((ad) => (
              <div
                key={ad.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden border border-slate-200"
              >
                <div className="p-6">
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-2">
                      {ad.type === 'product' ? 'Product' : 'Service'}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">{ad.company_name}</h3>
                    {ad.product_name && (
                      <p className="text-sm text-slate-600 mt-1">{ad.product_name}</p>
                    )}
                  </div>

                  {ad.services_provided && (
                    <p className="text-sm text-slate-700 mb-4 leading-relaxed">
                      {ad.services_provided}
                    </p>
                  )}

                  <div className="space-y-2 mb-4">
                    {ad.contact_name && (
                      <div className="flex items-center text-sm text-slate-600">
                        <span className="font-medium text-slate-900 mr-2">{ad.contact_name}</span>
                      </div>
                    )}
                    {ad.contact_phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                        <Phone size={16} />
                        <a href={`tel:${ad.contact_phone}`} className="hover:underline">
                          {ad.contact_phone}
                        </a>
                      </div>
                    )}
                    {ad.contact_email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                        <Mail size={16} />
                        <a href={`mailto:${ad.contact_email}`} className="hover:underline">
                          {ad.contact_email}
                        </a>
                      </div>
                    )}
                  </div>

                  {ad.website_url && (
                    <a
                      href={ad.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 w-full justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Visit Website
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
