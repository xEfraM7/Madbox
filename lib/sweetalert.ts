import Swal from "sweetalert2"

// Configuración base con tema oscuro acorde a la aplicación
const swalConfig = {
    background: "oklch(0.14 0.01 95)",
    color: "oklch(0.92 0.01 95)",
    confirmButtonColor: "oklch(0.7 0.2 95)",
    cancelButtonColor: "oklch(0.18 0.01 95)",
    iconColor: "oklch(0.7 0.2 95)",
    customClass: {
        popup: "rounded-lg border border-[oklch(0.22_0.01_95)]",
        confirmButton: "rounded-md px-4 py-2 font-medium",
        cancelButton: "rounded-md px-4 py-2 font-medium",
        title: "text-lg font-semibold",
        htmlContainer: "text-sm text-[oklch(0.6_0_0)]",
    },
    buttonsStyling: true,
    showClass: {
        popup: "animate-in fade-in-0 zoom-in-95",
    },
    hideClass: {
        popup: "animate-out fade-out-0 zoom-out-95",
    },
}

// Toast (notificación pequeña en esquina)
export const showToast = {
    success: (title: string, text?: string) => {
        Swal.fire({
            ...swalConfig,
            icon: "success",
            title,
            text,
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            iconColor: "#22c55e",
        })
    },
    error: (title: string, text?: string) => {
        Swal.fire({
            ...swalConfig,
            icon: "error",
            title,
            text,
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
            iconColor: "#ef4444",
        })
    },
    warning: (title: string, text?: string) => {
        Swal.fire({
            ...swalConfig,
            icon: "warning",
            title,
            text,
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true,
            iconColor: "#f59e0b",
        })
    },
    info: (title: string, text?: string) => {
        Swal.fire({
            ...swalConfig,
            icon: "info",
            title,
            text,
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            iconColor: "#3b82f6",
        })
    },
}

// Alertas modales (centradas)
export const showAlert = {
    success: (title: string, text?: string) => {
        return Swal.fire({
            ...swalConfig,
            icon: "success",
            title,
            text,
            confirmButtonText: "Aceptar",
            iconColor: "#22c55e",
        })
    },
    error: (title: string, text?: string) => {
        return Swal.fire({
            ...swalConfig,
            icon: "error",
            title,
            text,
            confirmButtonText: "Aceptar",
            iconColor: "#ef4444",
        })
    },
    warning: (title: string, text?: string) => {
        return Swal.fire({
            ...swalConfig,
            icon: "warning",
            title,
            text,
            confirmButtonText: "Aceptar",
            iconColor: "#f59e0b",
        })
    },
    info: (title: string, text?: string) => {
        return Swal.fire({
            ...swalConfig,
            icon: "info",
            title,
            text,
            confirmButtonText: "Aceptar",
            iconColor: "#3b82f6",
        })
    },
}

// Confirmación
export const showConfirm = async (
    title: string,
    text?: string,
    options?: {
        confirmText?: string
        cancelText?: string
        icon?: "warning" | "question" | "info"
    }
) => {
    const result = await Swal.fire({
        ...swalConfig,
        icon: options?.icon || "warning",
        title,
        text,
        showCancelButton: true,
        confirmButtonText: options?.confirmText || "Confirmar",
        cancelButtonText: options?.cancelText || "Cancelar",
        reverseButtons: true,
        iconColor: options?.icon === "question" ? "#3b82f6" : "#f59e0b",
    })
    return result.isConfirmed
}

// Loading
export const showLoading = (title: string = "Cargando...") => {
    Swal.fire({
        ...swalConfig,
        title,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading()
        },
    })
}

export const hideLoading = () => {
    Swal.close()
}

export default Swal
