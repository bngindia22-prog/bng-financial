import React from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, icon: Icon, color, subtitle, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Card className="relative overflow-hidden p-5 border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
        <div className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-[0.12] -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform duration-500" style={{ backgroundColor: color }} />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full opacity-[0.06] translate-y-6 -translate-x-6" style={{ backgroundColor: color }} />
        <div className="relative flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${color}18` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}