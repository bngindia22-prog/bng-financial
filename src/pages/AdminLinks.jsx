import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CATEGORIES } from '@/lib/constants';
import { Link2, Save, ShieldAlert, Headset } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export default function AdminLinks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [urls, setUrls] = useState({});
  const [labels, setLabels] = useState({});
  const [enabled, setEnabled] = useState({});
  const [initialized, setInitialized] = useState(false);
  const [careNumber, setCareNumber] = useState('');
  const [careInitialized, setCareInitialized] = useState(false);
  const { toast } = useToast();

  const { data: links = [] } = useQuery({
    queryKey: ['categoryLinks'],
    queryFn: () => base44.entities.CategoryLink.list(),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Setting.list(),
  });

  useEffect(() => {
    if (settings.length > 0 && !careInitialized) {
      const care = settings.find(s => s.key === 'customer_care_number');
      if (care) setCareNumber(care.value || '');
      setCareInitialized(true);
    }
  }, [settings, careInitialized]);

  const saveCareNumber = async () => {
    const existing = settings.find(s => s.key === 'customer_care_number');
    if (existing) {
      await base44.entities.Setting.update(existing.id, { key: 'customer_care_number', value: careNumber });
    } else {
      await base44.entities.Setting.create({ key: 'customer_care_number', value: careNumber });
    }
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    toast({ title: 'Customer Care number saved' });
  };

  const saveMutation = useMutation({
    mutationFn: async (category) => {
      const existing = links.find(l => l.category === category);
      const payload = {
        category,
        url: urls[category] || '',
        label: labels[category] || '',
        enabled: enabled[category] !== false,
      };
      if (existing) {
        return base44.entities.CategoryLink.update(existing.id, payload);
      } else {
        return base44.entities.CategoryLink.create(payload);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categoryLinks'] }),
  });

  const handleChange = (category, field, value) => {
    if (field === 'url') setUrls(p => ({ ...p, [category]: value }));
    if (field === 'label') setLabels(p => ({ ...p, [category]: value }));
    if (field === 'enabled') setEnabled(p => ({ ...p, [category]: value }));
  };

  useEffect(() => {
    if (links.length > 0 && !initialized) {
      const u = {}, l = {}, e = {};
      links.forEach(item => {
        u[item.category] = item.url || '';
        l[item.category] = item.label || '';
        e[item.category] = item.enabled !== false;
      });
      setUrls(u);
      setLabels(l);
      setEnabled(e);
      setInitialized(true);
    }
  }, [links, initialized]);

  // Only admin can access — after all hooks
  if (user && user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">Only admins can manage category links.</p>
        <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Link2 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl lg:text-3xl font-display font-bold">Category Links</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Admin Panel — Configure redirect URLs for each expense category button.
        </p>
      </motion.div>

      {/* Customer Care Number */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Headset className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Customer Care Number</h2>
              <p className="text-xs text-muted-foreground">Mobile number shown to users for support</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Mobile Number</Label>
              <Input
                className="mt-1"
                placeholder="e.g. 919652953160"
                value={careNumber}
                onChange={e => setCareNumber(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Include country code for WhatsApp (e.g. 91…)</p>
            </div>
            <Button size="sm" className="w-full gap-2" onClick={saveCareNumber}>
              <Save className="w-3.5 h-3.5" />
              Save Number
            </Button>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CATEGORIES.map((cat, idx) => {
          const currentLink = links.find(l => l.category === cat.key);
          return (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="p-5 border-0 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-semibold text-sm">{cat.label}</span>
                    <Badge variant="outline" className="text-[10px]">{cat.percentage}%</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Active</span>
                    <Switch
                      checked={enabled[cat.key] !== false}
                      onCheckedChange={(v) => handleChange(cat.key, 'enabled', v)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Redirect URL</Label>
                    <Input
                      className="mt-1"
                      placeholder="https://example.com/investment"
                      value={urls[cat.key] || ''}
                      onChange={e => handleChange(cat.key, 'url', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Custom Button Label (optional)</Label>
                    <Input
                      className="mt-1"
                      placeholder={`Open ${cat.label}`}
                      value={labels[cat.key] || ''}
                      onChange={e => handleChange(cat.key, 'label', e.target.value)}
                    />
                  </div>

                  {currentLink?.url && (
                    <p className="text-xs text-muted-foreground truncate">
                      Current: <a href={currentLink.url} target="_blank" rel="noreferrer" className="text-primary underline">{currentLink.url}</a>
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => saveMutation.mutate(cat.key)}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}