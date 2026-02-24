'use client';

export default function ScrollHint() {
  return (
    <div
      aria-hidden
      className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ animation: 'lv-float 2.5s ease-in-out infinite' }}
    >
      <div
        style={{
          width: 20,
          height: 32,
          borderRadius: 10,
          border: '1.5px solid #475569',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: 6,
        }}
      >
        <div
          style={{
            width: 3,
            height: 8,
            borderRadius: 2,
            background: '#64748B',
            animation: 'lv-float 1.5s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}
