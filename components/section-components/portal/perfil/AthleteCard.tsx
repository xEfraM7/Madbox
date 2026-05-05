"use client"

import { ATHLETE_LEVEL_LABEL } from "@/lib/constants/athlete"
import type { AthleteCardData } from "@/lib/actions/portal"

interface Props {
  data: AthleteCardData
  /** ref al div raíz, lo usa el hook para capturar */
  innerRef?: React.RefObject<HTMLDivElement | null>
}

const C = {
  bg0: "#050505",
  bg1: "#0a0a0a",
  accent: "#FACC15",
  accentSoft: "rgba(250, 204, 21, 0.15)",
  text: "#fafafa",
  muted: "#a1a1aa",
  border: "rgba(250, 204, 21, 0.4)",
  borderSoft: "rgba(250, 204, 21, 0.18)",
}

export function AthleteCard({ data, innerRef }: Props) {
  const initials = data.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const levelLabel = data.athleteLevel ? ATHLETE_LEVEL_LABEL[data.athleteLevel].toUpperCase() : null
  const subtitleParts = [
    levelLabel,
    data.athleteSinceYear ? `DESDE ${data.athleteSinceYear}` : null,
  ].filter(Boolean) as string[]
  const subtitle = subtitleParts.join(" · ")

  const hasAnyBodyMetric =
    data.age !== null || data.weightKg !== null || data.heightCm !== null

  return (
    <div
      ref={innerRef}
      style={{
        position: "fixed",
        left: "-99999px",
        top: 0,
        width: 1080,
        height: 1920,
        background: `linear-gradient(180deg, ${C.bg0} 0%, ${C.bg1} 100%)`,
        color: C.text,
        fontFamily: "'Geist', Georgia, serif",
        padding: 80,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {/* Logo del oso */}
      <img
        src="/Madbox_logo.jpeg"
        alt="Madbox"
        crossOrigin="anonymous"
        style={{
          width: 110,
          height: 110,
          borderRadius: "50%",
          border: `2px solid ${C.border}`,
          objectFit: "cover",
        }}
      />
      <p
        style={{
          margin: "20px 0 0 0",
          fontSize: 14,
          letterSpacing: 10,
          color: C.accent,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        — The Athlete File —
      </p>

      {/* Avatar con ticks decorativos */}
      <div style={{ marginTop: 60, position: "relative" }}>
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: "50%",
            border: `3px solid ${C.accent}`,
            background: `linear-gradient(135deg, ${C.accentSoft}, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={data.name}
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                fontSize: 140,
                fontWeight: 900,
                color: C.accent,
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                letterSpacing: 6,
              }}
            >
              {initials}
            </span>
          )}
        </div>
        <div style={{ position: "absolute", top: -20, left: "50%", width: 2, height: 30, background: C.accent, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", bottom: -20, left: "50%", width: 2, height: 30, background: C.accent, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", top: "50%", left: -30, width: 30, height: 2, background: C.accent, transform: "translateY(-50%)" }} />
        <div style={{ position: "absolute", top: "50%", right: -30, width: 30, height: 2, background: C.accent, transform: "translateY(-50%)" }} />
      </div>

      {/* Nombre */}
      <h1
        style={{
          margin: "56px 0 0 0",
          fontSize: 124,
          fontWeight: 900,
          textAlign: "center",
          letterSpacing: 6,
          textTransform: "uppercase",
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          lineHeight: 0.95,
        }}
      >
        {data.name}
      </h1>

      {/* Subtítulo: NIVEL · DESDE AÑO (con fallbacks) */}
      {subtitle && (
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 28 }}>
          <div style={{ width: 70, height: 1, background: C.accent }} />
          <p
            style={{
              margin: 0,
              fontSize: 22,
              color: C.muted,
              letterSpacing: 8,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {subtitle}
          </p>
          <div style={{ width: 70, height: 1, background: C.accent }} />
        </div>
      )}

      {/* Stats row: EDAD / PESO / ALTURA */}
      {hasAnyBodyMetric && (
        <div
          style={{
            marginTop: 64,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            width: "100%",
            gap: 16,
            paddingTop: 32,
            paddingBottom: 32,
            borderTop: `1px solid ${C.borderSoft}`,
            borderBottom: `1px solid ${C.borderSoft}`,
          }}
        >
          {[
            { label: "EDAD", value: data.age, unit: "años" },
            { label: "PESO", value: data.weightKg, unit: "kg" },
            { label: "ALTURA", value: data.heightCm, unit: "cm" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                borderLeft: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
                padding: "0 8px",
              }}
            >
              <p style={{ fontSize: 14, color: C.muted, letterSpacing: 4, margin: 0, fontWeight: 700 }}>
                {s.label}
              </p>
              <p
                style={{
                  fontSize: 72,
                  fontWeight: 900,
                  margin: "8px 0 0 0",
                  fontFamily: "'Bebas Neue', Impact, sans-serif",
                  color: C.text,
                  lineHeight: 1,
                }}
              >
                {s.value ?? "—"}
              </p>
              {s.value !== null && (
                <p style={{ fontSize: 14, color: C.muted, margin: "4px 0 0 0", letterSpacing: 2 }}>
                  {s.unit.toUpperCase()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quote */}
      {data.quote && (
        <p
          style={{
            marginTop: 48,
            fontSize: 32,
            fontStyle: "italic",
            color: C.text,
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 400,
            letterSpacing: 0.5,
          }}
        >
          &ldquo;{data.quote}&rdquo;
        </p>
      )}

      {/* Levantamientos olímpicos (siempre visibles, "—" si peso es 0) */}
      <p
        style={{
          marginTop: 56,
          fontSize: 16,
          color: C.accent,
          letterSpacing: 10,
          textAlign: "center",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        Levantamientos Olímpicos
      </p>
      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          width: "100%",
          gap: 24,
        }}
      >
        {data.topRecords.map((r, i) => (
          <div
            key={r.movement}
            style={{
              textAlign: "center",
              borderLeft: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              padding: "8px 4px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: C.muted,
                letterSpacing: 4,
                margin: 0,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {r.label}
            </p>
            <p
              style={{
                fontSize: 96,
                fontWeight: 900,
                margin: "10px 0 0 0",
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                color: C.accent,
                lineHeight: 1,
                letterSpacing: 2,
              }}
            >
              {r.weightKg > 0 ? r.weightKg.toLocaleString("es-VE") : "—"}
            </p>
            {r.weightKg > 0 && (
              <p style={{ fontSize: 16, color: C.muted, margin: "4px 0 0 0", letterSpacing: 4, fontWeight: 700 }}>
                KG
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Grand Total (solo si hay algo que sumar) */}
      {data.totals.grand > 0 && (
        <div
          style={{
            marginTop: 32,
            padding: "28px 64px",
            textAlign: "center",
            borderTop: `2px solid ${C.accent}`,
            borderBottom: `2px solid ${C.accent}`,
            width: "100%",
            maxWidth: 700,
          }}
        >
          <p style={{ fontSize: 16, color: C.muted, letterSpacing: 10, fontWeight: 700, margin: 0 }}>
            GRAND TOTAL
          </p>
          <p
            style={{
              fontSize: 120,
              fontWeight: 900,
              color: C.accent,
              fontFamily: "'Bebas Neue', Impact, sans-serif",
              margin: "8px 0 0 0",
              letterSpacing: 6,
              lineHeight: 1,
            }}
          >
            {data.totals.grand.toLocaleString("es-VE")}{" "}
            <span style={{ fontSize: 60, color: C.text }}>KG</span>
          </p>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          marginTop: 28,
          fontSize: 14,
          color: C.muted,
          letterSpacing: 12,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        the madbox · crossfit elite
      </p>
    </div>
  )
}
