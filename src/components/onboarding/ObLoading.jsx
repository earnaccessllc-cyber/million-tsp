import React from 'react';
import { motion } from 'framer-motion';
import ObShield from './ObShield';
import { BG, GOLD } from './ob-constants';

export default function ObLoading() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6"
      style={{ background: BG }}
    >
      {/* Glow halo */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 220, height: 220, background: 'radial-gradient(circle, rgba(201,168,50,0.18) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ObShield size={110} />
      </motion.div>

      <div className="flex flex-col items-center gap-2">
        <p style={{
          fontFamily: "'Share Tech Mono',monospace", fontSize: 12,
          color: GOLD, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          Setting up your account...
        </p>

        <div className="flex gap-2 mt-1">
          {[0, 0.22, 0.44].map((d, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: GOLD }}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: d }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}