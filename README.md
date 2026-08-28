# SNBusiness

Finanzas personales premium, 100% móvil. React 19 + TypeScript + Tailwind 4 +
Capacitor (Android) + Firebase + Gemini.

![Estado](https://img.shields.io/badge/estado-activo-2dd4a0) ![Plataforma](https://img.shields.io/badge/plataforma-Android%20%7C%20PWA-7c5cff)

## Qué hace

- **Meses automáticos**: cada mes se genera solo con tus pagos recurrentes; puedes borrar cualquier mes.
- **Gastos con sub-ítems** (ej. "Diario" → tomate, arroz…), servicios obligatorios y pagos únicos o recurrentes.
- **Deudas por cuotas**: define nº de cuotas, fecha final o cuota fija; progreso mes a mes.
- **5 vistas configurables**: tarjetas, lista, tabla estilo Excel, calendario y Gantt.
- **Semáforo de vencimientos**: cada pago se va poniendo rojo al acercarse su fecha.
- **Calendario anual + proyecciones** con líneas de ingresos/ahorro/gastos.
- **IA (Gemini)**: consejo del día, recomendación de pagos y 3 planes de pago; siempre con respaldo sin conexión.
- **Recordatorios y alarmas** (notificaciones nativas en Android, modo alarma intrusiva).
- **Celebraciones**: confeti + sonido al pagar y fanfarria al completar el mes (todo configurable).
- **Temas**: claro/oscuro, 6 paletas, color de acento y fondo personalizado (hasta tu propia foto).
- **Excel**: exporta resumen, detalle, deudas y una plantilla lista para usar.
- **Cuenta opcional** con correo o Google y sincronización en Firestore.

## Inicio rápido

```bash
npm install
npm run dev
```

Configuración completa (Firebase, IA, APK, secrets): **[SETUP.md](SETUP.md)**.

## Stack

Vite 8 · React 19 · TypeScript · Tailwind CSS 4 · Zustand · Capacitor 8 ·
Firebase (Auth + Firestore) · ExcelJS · canvas-confetti · Gemini API.
