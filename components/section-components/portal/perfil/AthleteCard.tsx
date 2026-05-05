"use client"

import { ATHLETE_LEVEL_LABEL } from "@/lib/constants/athlete"
import type { AthleteCardData } from "@/lib/actions/portal"

interface Props {
  data: AthleteCardData
  /** ref al div raíz, lo usa el hook para capturar */
  innerRef?: React.RefObject<HTMLDivElement | null>
}

const COLORS = {
  bgFrom: "#0a0a0a",
  bgTo: "#171717",
  accent: "#FACC15",
  accentSoft: "rgba(250, 204, 21, 0.15)",
  text: "#fafafa",
  muted: "#a1a1aa",
  border: "rgba(250, 204, 21, 0.4)",
}

export function AthleteCard({ data, innerRef }: Props) {
  const initials = data.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const subtitle = [
    data.planName ? data.planName.toUpperCase() : null,
    data.athleteSinceYear ? `ATLETA DESDE ${data.athleteSinceYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      ref={innerRef}
      style={{
        position: "fixed",
        left: "-99999px",
        top: 0,
        width: 1080,
        height: 1920,
        background: `linear-gradient(180deg, ${COLORS.bgFrom} 0%, ${COLORS.bgTo} 100%)`,
        color: COLORS.text,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: 64,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {/* Logo */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <img
          src="/madbox-logo.svg"
          alt="Madbox"
          width={240}
          height={60}
          crossOrigin="anonymous"
          style={{ display: "block" }}
        />
      </div>

      {/* Avatar */}
      <div style={{ marginTop: 80, width: 280, height: 280, borderRadius: "50%", border: `4px solid ${COLORS.accent}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${COLORS.accentSoft}, transparent)` }}>
        {data.avatarUrl ? (
          <img
            src={data.avatarUrl}
            alt={data.name}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 96, fontWeight: 900, color: COLORS.accent, fontFamily: "'Bebas Neue', Impact, sans-serif" }}>
            {initials}
          </span>
        )}
      </div>

      {/* Nombre */}
      <h1
        style={{
          marginTop: 40,
          fontSize: 76,
          fontWeight: 900,
          letterSpacing: 2,
          textAlign: "center",
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          textTransform: "uppercase",
          margin: "40px 0 0 0",
        }}
      >
        {data.name}
      </h1>

      {/* Línea dorada */}
      <div style={{ width: 200, height: 2, background: COLORS.accent, marginTop: 16 }} />

      {/* Subtítulo */}
      {subtitle && (
        <p style={{ marginTop: 16, fontSize: 22, color: COLORS.muted, letterSpacing: 1.5, textAlign: "center" }}>
          {subtitle}
        </p>
      )}

      {/* Stats grid */}
      {(data.age !== null || data.weightKg !== null || data.heightCm !== null || data.athleteLevel !== null) && (
        <div
          style={{
            marginTop: 56,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            width: "100%",
            maxWidth: 880,
          }}
        >
          {[
            { label: "EDAD", value: data.age, unit: "años" },
            { label: "PESO", value: data.weightKg, unit: "kg" },
            { label: "ALTURA", value: data.heightCm, unit: "cm" },
            {
              label: "NIVEL",
              value: data.athleteLevel ? ATHLETE_LEVEL_LABEL[data.athleteLevel] : null,
              unit: "",
            },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "20px 12px",
                textAlign: "center",
                background: "rgba(0,0,0,0.3)",
              }}
            >
              <p style={{ fontSize: 14, color: COLORS.muted, letterSpacing: 2, margin: 0 }}>{stat.label}</p>
              <p
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  margin: "8px 0 4px 0",
                  fontFamily: "'Bebas Neue', Impact, sans-serif",
                  letterSpacing: 1,
                }}
              >
                {stat.value ?? "—"}
              </p>
              {stat.unit && (
                <p style={{ fontSize: 12, color: COLORS.muted, margin: 0 }}>{stat.unit}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quote */}
      {data.quote && (
        <p
          style={{
            marginTop: 40,
            fontSize: 28,
            fontStyle: "italic",
            color: COLORS.text,
            textAlign: "center",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          &ldquo;{data.quote}&rdquo;
        </p>
      )}

      {/* Records */}
      {data.topRecords.length > 0 && (
        <div style={{ marginTop: 56, width: "100%", maxWidth: 880 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            <span
              style={{
                fontSize: 16,
                color: COLORS.muted,
                letterSpacing: 3,
                fontWeight: 600,
              }}
            >
              RECORDS PERSONALES
            </span>
            <div style={{ flex: 1, height: 1, background: COLORS.border }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.topRecords.map((r) => (
              <div
                key={r.movement}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                  {r.label}
                </span>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: COLORS.accent,
                    fontFamily: "'Bebas Neue', Impact, sans-serif",
                    letterSpacing: 1,
                  }}
                >
                  {r.weightKg.toLocaleString("es-VE")} KG
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grand Total */}
      {data.totals.grand > 0 && (
        <div
          style={{
            marginTop: "auto",
            border: `2px solid ${COLORS.accent}`,
            borderRadius: 8,
            padding: "24px 48px",
            textAlign: "center",
            background: COLORS.accentSoft,
            boxShadow: `0 0 30px ${COLORS.accentSoft}`,
            minWidth: 480,
          }}
        >
          <p style={{ fontSize: 18, color: COLORS.muted, letterSpacing: 4, fontWeight: 600, margin: 0 }}>
            GRAND TOTAL
          </p>
          <p
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: COLORS.accent,
              fontFamily: "'Bebas Neue', Impact, sans-serif",
              letterSpacing: 3,
              margin: "8px 0 0 0",
            }}
          >
            {data.totals.grand.toLocaleString("es-VE")} KG
          </p>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          marginTop: 32,
          fontSize: 16,
          color: COLORS.muted,
          letterSpacing: 4,
          textTransform: "lowercase",
        }}
      >
        madbox · crossfit elite
      </p>
    </div>
  )
}
