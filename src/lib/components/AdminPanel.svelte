<script lang="ts">
	import {
		AlertTriangle,
		ArrowRight,
		BadgeCheck,
		Ban,
		Banknote,
		ExternalLink,
		FileUp,
		Loader2,
		Lock,
		Pencil,
		Plus,
		RefreshCw,
		Save,
		Scale,
		ShieldCheck,
		Trash2,
		Undo2,
		X,
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import { sfx, vibrate } from "$lib/audio/sfx";
	import TermsDialog from "$lib/components/TermsDialog.svelte";
	import { undoable } from "$lib/components/toast/toastStore";
	import DataTable from "$lib/components/ui/datatable/DataTable.svelte";
	import type { Column } from "$lib/components/ui/datatable/datatable.types";
	import {
		advanceRound,
		adminActorHash,
		getDataLock,
		getMergedPayments,
		getPanitiaParticipants,
		rejectPayment,
		saveCompetition,
		savePaymentConfig,
		setDataLock,
		undoCheckIn,
		verifyPayment,
		type DataLockState,
		type PanitiaParticipant,
		type PaymentWithMeta,
	} from "$lib/db/admin";
	import { checkInParticipant } from "$lib/db/checkin";
	import { submitCashPayment } from "$lib/db/payment";
	import {
		importParticipantRows,
		previewParticipantCsv,
		type ParticipantCsvPreview,
		type ParticipantImportResult,
	} from "$lib/db/participantImport";
	import { getCompetitions, getPaymentConfigs } from "$lib/db/queries";
	import type { Competition, PaymentConfig } from "$lib/db/queries";
	import { staffRole, type StaffRole } from "$lib/db/schema";
	import {
		listStaffMembers,
		setStaffActive,
		upsertStaffMember,
		type StaffMember,
	} from "$lib/db/staff";
	import {
		deleteSponsor as deleteSponsorRecord,
		getSponsors,
		saveSponsor as saveSponsorRecord,
		uploadSponsorImage,
		type Sponsor,
	} from "$lib/db/sponsor";

	type AdminTab =
		| "config"
		| "competition"
		| "sponsor"
		| "verify"
		| "panitia"
		| "staff";
	type PaymentStatus = "all" | "baru" | "lunas" | "belum_lunas" | "ditolak";
	type PaymentAction = "verify" | "reject" | "settle";
	type ImportStep = 1 | 2 | 3 | 4;

	const PAGE_SIZE = 8;
	const paymentMethodLabels: Record<string, string> = {
		bank_transfer: "TF-bank",
		ewallet: "E-wallet",
		qris: "QRIS",
		cash: "Tunai",
	};
	const paymentStatusLabels: Record<PaymentStatus, string> = {
		all: "Semua status",
		baru: "Baru",
		lunas: "Lunas",
		belum_lunas: "Belum lunas",
		ditolak: "Ditolak",
	};
	const CUSTOM_REJECTION_REASON = "__custom__";
	const rejectionReasonTemplates = [
		"Bukti pembayaran tidak terbaca.",
		"Nominal pembayaran tidak sesuai dengan tagihan.",
		"Bukti pembayaran tidak sesuai dengan nama atau nomor WA peserta.",
		"Transaksi belum ditemukan pada mutasi rekening.",
		"Bukti pembayaran sudah digunakan atau terduplikasi.",
		"Metode pembayaran tidak sesuai dengan pilihan pendaftaran.",
	] as const;
	const scoringModeLabels: Record<string, string> = {
		terberat: "Ikan terberat",
		kumulatif: "Berat kumulatif",
		jackpot_pita: "Jackpot pita",
		layangan_aduan: "Aduan layangan",
		layangan_hias: "Layangan hias",
	};
let competitions = $state<Competition[]>([]);
let configs = $state<PaymentConfig[]>([]);
let sponsors = $state<Sponsor[]>([]);
let payments = $state<PaymentWithMeta[]>([]);
let panitiaParticipants = $state<PanitiaParticipant[]>([]);
let staffMembers = $state<StaffMember[]>([]);
let editingStaffId = $state<string | null>(null);
let staffForm = $state<{ role: StaffRole; name: string; phone: string }>({
	role: "panitia",
	name: "",
	phone: "",
});
let staffSaving = $state(false);
let staffTogglingId = $state<string | null>(null);
let staffError = $state("");
let panitiaSaving = $state<string | null>(null);
let panitiaFilter = $state("all");
let loading = $state(true);
let showTerms = $state(false);
	let error = $state("");
	let tab = $state<AdminTab>("verify");
	let savingId = $state<string | null>(null);
	let advancing = $state<string | null>(null);
	let actingPayment = $state<string | null>(null);
	let selectedPayment = $state<PaymentWithMeta | null>(null);
	let paymentAction = $state<PaymentAction | null>(null);
	let paymentActionError = $state("");
	let actionReason = $state("");
	let rejectionTemplate = $state("");
	let roundCompetition = $state<Competition | null>(null);
	let forceAdvance = $state(false);
	let unjudgedCount = $state(0);
	let paymentPage = $state(1);
	let paymentStatusFilter = $state<PaymentStatus>("all");
	let paymentMethodFilter = $state("all");
	let paymentCompetitionFilter = $state("all");
	let editingSponsorId = $state<string | null>(null);
	let sponsorForm = $state({ imageUrl: "", url: "" });
	let sponsorImageFile = $state<File | null>(null);
	let sponsorImagePreview = $state<string>("");
	let sponsorSaving = $state(false);
	let sponsorUploading = $state(false);
	let deletingSponsorId = $state<string | null>(null);
	let sponsorFileInput = $state<HTMLInputElement | null>(null);
	let importDialogOpen = $state(false);
	let importStep = $state<ImportStep>(1);
	let importFile = $state<File | null>(null);
	let importFileName = $state("");
	let importPreview = $state<ParticipantCsvPreview | null>(null);
	let importResult = $state<ParticipantImportResult | null>(null);
	let importFileError = $state("");
	let importing = $state(false);
	let paymentTableColumns = $state<Column<PaymentWithMeta>[]>([
		{
			key: "participant",
			label: "Peserta",
			getValue: (row) => row.participantName,
			sortable: true,
			wrap: true,
			width: "18%",
		},
		{
			key: "competition",
			label: "Lomba",
			getValue: (row) => row.competitionName,
			sortable: true,
			wrap: true,
			width: "16%",
		},
		{
			key: "ticket",
			label: "Tiket",
			getValue: (row) => row.participantTicket,
			sortable: true,
			wrap: true,
			hidden: true,
			width: "10%",
		},
		{
			key: "phone",
			label: "No. WA",
			getValue: (row) => row.participantPhone,
			sortable: true,
			wrap: true,
			hidden: true,
			width: "12%",
		},
		{
			key: "amount",
			label: "Nominal",
			getValue: (row) => Number(row.amount),
			sortable: true,
			width: "13%",
			align: "right",
		},
		{
			key: "method",
			label: "Metode",
			getValue: (row) => methodLabel(row.paymentMethod),
			sortable: true,
			wrap: true,
			width: "14%",
		},
		{
			key: "status",
			label: "Status",
			getValue: (row) => statusLabel(row),
			sortable: true,
			width: "12%",
		},
		{
			key: "proof",
			label: "Bukti",
			getValue: (row) => (hasProof(row) ? "Tersedia" : "Belum ada"),
			wrap: true,
			width: "11%",
		},
		{
			key: "createdAt",
			label: "Dibuat",
			getValue: (row) => formatDate(row.createdAt),
			sortable: true,
			wrap: true,
			width: "14%",
		},
		{
			key: "actions",
			label: "Aksi",
			getValue: () => "",
			width: "18%",
		},
	]);

	const load = async () => {
		try {
			const [comps, cfgs, allPayments, sponsorList, panitia, lock, staff] =
				await Promise.all([
					getCompetitions(false),
					getPaymentConfigs(false),
					getMergedPayments(),
					getSponsors(),
					getPanitiaParticipants(),
					getDataLock(),
					listStaffMembers(),
				]);
			competitions = comps;
			configs = cfgs;
			payments = allPayments;
			sponsors = sponsorList;
			panitiaParticipants = panitia;
			dataLock = lock;
			staffMembers = staff;
			error = "";
		} catch (e) {
			error = e instanceof Error ? e.message : "Gagal memuat data admin.";
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		void load();
	});

	$effect(() => {
		const modalOpen = selectedPayment !== null || roundCompetition !== null;
		if (!modalOpen) {
			return;
		}
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	const filteredPayments = $derived(
		payments.filter((p) => {
			const status = paymentStatus(p);
			return (
				(paymentStatusFilter === "all" ||
					status === paymentStatusFilter) &&
				(paymentMethodFilter === "all" ||
					p.paymentMethod === paymentMethodFilter) &&
				(paymentCompetitionFilter === "all" ||
					p.competitionName === paymentCompetitionFilter)
			);
		}),
	);
	const paymentMethods = $derived(
		Array.from(new Set(payments.map((p) => p.paymentMethod))),
	);

	function paymentStatus(p: PaymentWithMeta): Exclude<PaymentStatus, "all"> {
		if (!p.isVerified) {
			return p.rejectReason ? "ditolak" : "baru";
		}
		const fee =
			competitions.find((c) => c.name === p.competitionName)?.fee ?? 0;
		const paid = payments
			.filter(
				(payment) =>
					payment.participantId === p.participantId &&
					payment.isVerified &&
					!payment.rejectReason?.trim(),
			)
			.reduce((sum, payment) => sum + Number(payment.amount), 0);
		return paid >= fee ? "lunas" : "belum_lunas";
	}

	function remainingForParticipant(p: PaymentWithMeta): number {
		const fee =
			competitions.find((c) => c.name === p.competitionName)?.fee ?? 0;
		const paid = payments
			.filter(
				(payment) =>
					payment.participantId === p.participantId &&
					payment.isVerified &&
					!payment.rejectReason?.trim(),
			)
			.reduce((sum, payment) => sum + Number(payment.amount), 0);
		return Math.max(0, fee - paid);
	}

	function canSettlePayment(p: PaymentWithMeta): boolean {
		return (
			p.isVerified && !p.rejectReason && remainingForParticipant(p) > 0
		);
	}

	// B2-5/A8: true bila peserta punya pembayaran pending lain (selain yang
	// sedang di-settle) yang bisa menutupi sisa → peringatan double-charge.
	function settleHasPendingWarning(p: PaymentWithMeta): boolean {
		return payments.some(
			(pay) =>
				pay.participantId === p.participantId &&
				pay.id !== p.id &&
				!pay.isVerified &&
				!pay.rejectReason,
		);
	}

	function methodLabel(method: string): string {
		return paymentMethodLabels[method] ?? method.replaceAll("_", " ");
	}

	function statusLabel(p: PaymentWithMeta): string {
		return paymentStatusLabels[paymentStatus(p)];
	}

	function statusTone(p: PaymentWithMeta): string {
		return {
			baru: "border-sky-300/30 bg-sky-300/10 text-sky-200",
			lunas: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
			belum_lunas: "border-amber-300/30 bg-amber-300/10 text-amber-200",
			ditolak: "border-rose-300/30 bg-rose-300/10 text-rose-200",
		}[paymentStatus(p)];
	}

	function methodTone(method: string): string {
		return (
			{
				bank_transfer:
					"border-indigo-300/30 bg-indigo-300/10 text-indigo-200",
				ewallet: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
				qris: "border-violet-300/30 bg-violet-300/10 text-violet-200",
				cash: "border-slate-300/30 bg-slate-300/10 text-slate-200",
			}[method] ?? "border-border bg-muted/40 text-muted-foreground"
		);
	}

	function formatDate(value: Date | string | null | undefined): string {
		if (!value) return "—";
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "—"
			: date.toLocaleString("id-ID", {
					dateStyle: "short",
					timeStyle: "short",
				});
	}

	function hasProof(p: PaymentWithMeta): boolean {
		return Boolean(p.proofImageUrl);
	}

	const saveComp = async (c: Competition) => {
		if (savingId !== null) return;
		savingId = c.id;
		error = "";
		try {
			await saveCompetition(c, await adminActorHash());
			undoable("Konfigurasi kompetisi tersimpan.", {
				onConfirm: () => {},
			});
			await load();
			sfx.confirm();
		} catch (e) {
			sfx.error();
			error = e instanceof Error ? e.message : "Gagal menyimpan.";
		} finally {
			savingId = null;
		}
	};

	const saveConfig = async (cfg: PaymentConfig) => {
		if (savingId !== null) return;
		savingId = cfg.id;
		error = "";
		try {
			await savePaymentConfig(cfg, await adminActorHash());
			undoable("Konfigurasi pembayaran tersimpan.", {
				onConfirm: () => {},
			});
			await load();
			sfx.confirm();
		} catch (e) {
			sfx.error();
			error = e instanceof Error ? e.message : "Gagal menyimpan.";
		} finally {
			savingId = null;
		}
	};

	function isHttpUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	}

	function resetSponsorForm(): void {
		editingSponsorId = null;
		sponsorForm.imageUrl = "";
		sponsorForm.url = "";
		sponsorImageFile = null;
		if (sponsorImagePreview) {
			URL.revokeObjectURL(sponsorImagePreview);
		}
		sponsorImagePreview = "";
	}

	function editSponsor(sponsor: Sponsor): void {
		editingSponsorId = sponsor.id;
		sponsorForm.imageUrl = sponsor.imageUrl;
		sponsorForm.url = sponsor.url;
		sponsorImageFile = null;
		if (sponsorImagePreview) {
			URL.revokeObjectURL(sponsorImagePreview);
		}
		sponsorImagePreview = "";
	}

	const handleSponsorImage = (input: HTMLInputElement) => {
		const chosen = input.files?.[0];
		if (!chosen) return;
		if (sponsorImagePreview) {
			URL.revokeObjectURL(sponsorImagePreview);
		}
		sponsorImageFile = chosen;
		sponsorImagePreview = URL.createObjectURL(chosen);
		sponsorForm.imageUrl = "";
	};

	const saveSponsorEntry = async () => {
		const url = sponsorForm.url.trim();
		if (!isHttpUrl(url)) {
			error =
				"URL tujuan sponsor harus menggunakan http:// atau https://.";
			return;
		}
		let imageUrl = sponsorForm.imageUrl.trim();
		if (sponsorImageFile) {
			sponsorUploading = true;
			error = "";
			try {
				imageUrl = await uploadSponsorImage(sponsorImageFile);
			} catch (e) {
				sfx.error();
				error =
					e instanceof Error
						? e.message
						: "Gagal mengunggah gambar sponsor.";
				sponsorUploading = false;
				return;
			}
			sponsorUploading = false;
		}
		if (!isHttpUrl(imageUrl)) {
			error =
				"Pilih gambar banner atau berikan URL gambar yang valid (http:// atau https://).";
			return;
		}
		sponsorSaving = true;
		error = "";
		try {
			const existing = sponsors.find(
				(sponsor) => sponsor.id === editingSponsorId,
			);
			await saveSponsorRecord({
				id: editingSponsorId ?? crypto.randomUUID(),
				imageUrl,
				url,
				createdAt: existing?.createdAt ?? new Date(),
			});
			undoable(
				editingSponsorId
					? "Sponsor diperbarui."
					: "Sponsor ditambahkan.",
				{ onConfirm: () => {} },
			);
			await load();
			resetSponsorForm();
			sfx.confirm();
		} catch (e) {
			sfx.error();
			error = e instanceof Error ? e.message : "Gagal menyimpan sponsor.";
		} finally {
			sponsorSaving = false;
		}
	};

	const removeSponsor = async (sponsor: Sponsor) => {
		if (deletingSponsorId !== null) return;
		if (
			typeof window !== "undefined" &&
			!window.confirm("Hapus sponsor ini dari landing?")
		)
			return;
		deletingSponsorId = sponsor.id;
		error = "";
		try {
			await deleteSponsorRecord(sponsor.id);
			undoable("Sponsor dihapus dari landing.", { onConfirm: () => {} });
			await load();
			if (editingSponsorId === sponsor.id) resetSponsorForm();
			sfx.confirm();
		} catch (e) {
			sfx.error();
			error = e instanceof Error ? e.message : "Gagal menghapus sponsor.";
		} finally {
			deletingSponsorId = null;
		}
	};

	const panitiaCheckIn = async (row: PanitiaParticipant) => {
		if (panitiaSaving !== null) return;
		panitiaSaving = row.participant.id;
		error = "";
		try {
			const result = await checkInParticipant(
				row.participant.id,
				await adminActorHash(),
			);
			const msg =
				result.eligibility === "already"
					? "Peserta sudah check-in sebelumnya."
					: "Peserta berhasil check-in.";
			sfx.confirm();
			undoable(msg, { onConfirm: () => {} });
			await load();
		} catch (e) {
			sfx.error();
			error = e instanceof Error ? e.message : "Gagal check-in peserta.";
		} finally {
			panitiaSaving = null;
		}
	};

	const panitiaUndoCheckIn = async (row: PanitiaParticipant) => {
		if (panitiaSaving !== null) return;
		if (
			typeof window !== "undefined" &&
			!window.confirm(`Batalkan check-in ${row.participant.name}?`)
		) {
			return;
		}
		panitiaSaving = row.participant.id;
		error = "";
		try {
			await undoCheckIn(row.participant.id, await adminActorHash());
			sfx.confirm();
			undoable("Check-in dibatalkan.", { onConfirm: () => {} });
			await load();
		} catch (e) {
			sfx.error();
			error =
				e instanceof Error ? e.message : "Gagal membatalkan check-in.";
		} finally {
			panitiaSaving = null;
		}
	};

	const resetStaffForm = () => {
		editingStaffId = null;
		staffForm = { role: "panitia", name: "", phone: "" };
		staffError = "";
	};

	const editStaff = (row: StaffMember) => {
		editingStaffId = row.id;
		staffForm = { role: row.role, name: row.name, phone: row.phone };
		staffError = "";
	};

	const saveStaffEntry = async () => {
		if (staffSaving) return;
		staffSaving = true;
		staffError = "";
		try {
			await upsertStaffMember({
				id: editingStaffId ?? undefined,
				role: staffForm.role,
				name: staffForm.name,
				phone: staffForm.phone,
			});
			sfx.confirm();
			undoable(
				editingStaffId ? "Anggota roster diperbarui." : "Anggota roster ditambahkan.",
				{ onConfirm: () => {} },
			);
			resetStaffForm();
			await load();
		} catch (e) {
			sfx.error();
			staffError = e instanceof Error ? e.message : "Gagal menyimpan anggota.";
		} finally {
			staffSaving = false;
		}
	};

	const toggleStaffActive = async (row: StaffMember) => {
		if (staffTogglingId !== null) return;
		staffTogglingId = row.id;
		staffError = "";
		try {
			await setStaffActive(row.id, !row.isActive);
			sfx.confirm();
			await load();
		} catch (e) {
			sfx.error();
			staffError = e instanceof Error ? e.message : "Gagal mengubah status.";
		} finally {
			staffTogglingId = null;
		}
	};

	function openPayment(p: PaymentWithMeta): void {
		selectedPayment = p;
		paymentAction = null;
		paymentActionError = "";
		actionReason = "";
		rejectionTemplate = "";
	}

	function openImportDialog(): void {
		importDialogOpen = true;
		importStep = 1;
		importFile = null;
		importFileName = "";
		importPreview = null;
		importResult = null;
		importFileError = "";
	}

	function closeImportDialog(): void {
		if (importing) return;
		importDialogOpen = false;
	}

	function selectImportFile(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		importFile = input.files?.[0] ?? null;
		importFileName = importFile?.name ?? "";
		importFileError = "";
		importPreview = null;
	}

	const readImportFile = async () => {
		if (!importFile) {
			importFileError = "Pilih file CSV terlebih dahulu.";
			return;
		}
		if (!importFile.name.toLowerCase().endsWith(".csv")) {
			importFileError =
				"File harus berekstensi .csv, bukan Excel (.xlsx).";
			return;
		}
		if (importFile.size > 5 * 1024 * 1024) {
			importFileError = "Ukuran CSV maksimal 5 MB.";
			return;
		}
		importFileError = "";
		try {
			importPreview = await previewParticipantCsv(
				await importFile.text(),
				competitions,
			);
			importStep = 3;
		} catch (e) {
			importFileError =
				e instanceof Error ? e.message : "Gagal membaca file CSV.";
		}
	};

	const runParticipantImport = async () => {
		if (
			!importPreview ||
			importPreview.rows.length === 0 ||
			importPreview.issues.some((item) => item.level === "error")
		) {
			return;
		}
		importing = true;
		try {
			importResult = await importParticipantRows(importPreview.rows);
			await load();
			importStep = 4;
		} catch (e) {
			importFileError =
				e instanceof Error ? e.message : "Gagal mengimpor peserta.";
		} finally {
			importing = false;
		}
	};

	function openPaymentAction(
		p: PaymentWithMeta,
		action: PaymentAction,
	): void {
		selectedPayment = p;
		paymentAction = action;
		paymentActionError = "";
		actionReason = "";
		rejectionTemplate = "";
	}

	function selectRejectionTemplate(template: string): void {
		rejectionTemplate = template;
		actionReason = template === CUSTOM_REJECTION_REASON ? "" : template;
		paymentActionError = "";
	}

	function closePaymentModal(): void {
		if (actingPayment !== null) return;
		selectedPayment = null;
		paymentAction = null;
		paymentActionError = "";
		actionReason = "";
		rejectionTemplate = "";
	}

	// B1-8/A17: data lock pasca-acara.
	let dataLock = $state<DataLockState>({
		locked: false,
		lockedAt: null,
		lockedBy: null,
	});
	let lockSaving = $state(false);

	const toggleDataLock = async () => {
		if (lockSaving) return;
		lockSaving = true;
		error = "";
		try {
			const next = await setDataLock(
				!dataLock.locked,
				await adminActorHash(),
			);
			dataLock = next;
			undoable(
				next.locked
					? "Data terkunci — semua tulis diblokir."
					: "Data dibuka kembali.",
				{ onConfirm: () => {} },
			);
			sfx.confirm();
		} catch (e) {
			sfx.error();
			error =
				e instanceof Error ? e.message : "Gagal mengubah data lock.";
		} finally {
			lockSaving = false;
		}
	};

	const verify = async (p: PaymentWithMeta) => {
		if (actingPayment !== null) return;
		// QW-5/A11: non-tunai tanpa bukti pasti ditolak lapisan db — blokir
		// dini di UI dengan pesan yang sama.
		if (!hasProof(p) && p.paymentMethod !== "cash") {
			paymentActionError =
				"Verifikasi ditolak: bukti pembayaran tidak ada. Minta peserta unggah bukti atau tolak pembayaran.";
			return;
		}
		actingPayment = p.id;
		paymentActionError = "";
		try {
			const actorHash = await adminActorHash();
			await verifyPayment(p.id, actorHash);
			undoable(`Pembayaran ${p.participantName} terverifikasi.`, {
				onConfirm: () => {},
			});
			await load();
			sfx.coin();
			vibrate(80);
			actingPayment = null;
			closePaymentModal();
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			paymentActionError =
				e instanceof Error
					? e.message
					: "Gagal memverifikasi pembayaran.";
		} finally {
			actingPayment = null;
		}
	};

	const reject = async (p: PaymentWithMeta) => {
		if (actingPayment !== null) return;
		const reason = actionReason.trim();
		if (!reason) {
			paymentActionError = "Alasan penolakan wajib diisi.";
			return;
		}
		actingPayment = p.id;
		paymentActionError = "";
		try {
			const actorHash = await adminActorHash();
			await rejectPayment(p.id, actorHash, reason);
			undoable(`Pembayaran ${p.participantName} ditolak.`, {
				onConfirm: () => {},
			});
			await load();
			sfx.error();
			vibrate([120, 60, 120]);
			actingPayment = null;
			closePaymentModal();
		} catch (e) {
			paymentActionError =
				e instanceof Error ? e.message : "Gagal menolak pembayaran.";
		} finally {
			actingPayment = null;
		}
	};

	const settle = async (p: PaymentWithMeta) => {
		if (actingPayment !== null || !canSettlePayment(p)) return;
		const competition = competitions.find(
			(c) => c.name === p.competitionName,
		);
		if (!competition) {
			paymentActionError = "Kompetisi peserta tidak ditemukan.";
			return;
		}
		actingPayment = p.id;
		paymentActionError = "";
		try {
			await submitCashPayment(
				{
					participantId: p.participantId,
					competitionId: competition.id,
				},
				{ fee: competition.fee },
			);
			undoable(`Peserta ${p.participantName} sekarang lunas.`, {
				onConfirm: () => {},
			});
			await load();
			sfx.coin();
			vibrate([80, 40, 120]);
			actingPayment = null;
			closePaymentModal();
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			paymentActionError =
				e instanceof Error ? e.message : "Gagal mencatat pelunasan.";
		} finally {
			actingPayment = null;
		}
	};

	function openRoundDialog(c: Competition): void {
		roundCompetition = c;
		error = "";
	}

	function closeRoundDialog(): void {
		if (advancing !== null) return;
		roundCompetition = null;
	}

	const nextRound = async () => {
		const c = roundCompetition;
		if (!c || advancing !== null) return;
		advancing = c.id;
		error = "";
		try {
			const res = await advanceRound(c.id, await adminActorHash(), {
				force: forceAdvance,
			});
			if (!res.ok) {
				// B4-1/A15: masih ada peserta belum dinilai — minta konfirmasi paksa.
				forceAdvance = true;
				unjudgedCount = res.unjudged ?? 0;
				error = `${res.unjudged ?? 0} peserta belum dinilai pada babak ini.`;
				return;
			}
			undoable(`Babak ${c.name} sekarang memasuki ronde ${res.round}.`, {
				onConfirm: () => {},
			});
			await load();
			sfx.fanfare();
			vibrate([80, 40, 120, 40, 80]);
			roundCompetition = null;
			forceAdvance = false;
			unjudgedCount = 0;
		} catch (e) {
			sfx.error();
			vibrate([120, 60, 120]);
			error =
				e instanceof Error
					? e.message
					: "Gagal memulai babak berikutnya.";
		} finally {
			advancing = null;
		}
	};
</script>

<div class="flex min-w-0 w-full flex-col gap-4">
	{#if error}
		<p class="text-sm text-destructive" role="alert">{error}</p>
	{/if}

	{#if loading}
		<div class="flex items-center gap-2 py-10 text-muted-foreground">
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
			<p class="text-sm">Memuat…</p>
		</div>
	{:else}
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-sm font-semibold">Data peserta</p>
				<p class="text-xs text-muted-foreground">
					Tambah peserta secara massal dengan CSV tervalidasi.
				</p>
			</div>
			<button
				type="button"
				class="btn btn-gold shrink-0"
				onclick={openImportDialog}
			>
				<FileUp class="h-4 w-4" aria-hidden="true" />
				Import peserta CSV
			</button>
		</div>
		<nav
			class="no-scrollbar flex min-w-0 snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1 [touch-action:pan-x]"
			aria-label="Menu admin"
		>
			<button
				type="button"
				class="btn shrink-0 snap-start whitespace-nowrap {tab ===
				'verify'
					? 'btn-gold'
					: ''}"
				onclick={() => (tab = "verify")}
			>
				<ShieldCheck class="h-4 w-4" aria-hidden="true" />
				Verifikasi ({payments.length})
			</button>
			<button
				type="button"
				class="btn shrink-0 snap-start whitespace-nowrap {tab ===
				'competition'
					? 'btn-gold'
					: ''}"
				onclick={() => (tab = "competition")}
			>
				Kompetisi
			</button>
			<button
				type="button"
				class="btn shrink-0 snap-start whitespace-nowrap {tab ===
				'config'
					? 'btn-gold'
					: ''}"
				onclick={() => (tab = "config")}
			>
				Metode Pembayaran
			</button>
			<button
				type="button"
				class="btn shrink-0 snap-start whitespace-nowrap {tab ===
				'sponsor'
					? 'btn-gold'
					: ''}"
				onclick={() => (tab = "sponsor")}
			>
				Sponsor
			</button>
			<button
				type="button"
				class="btn shrink-0 snap-start whitespace-nowrap {tab ===
				'panitia'
					? 'btn-gold'
					: ''}"
				onclick={() => (tab = "panitia")}
			>
				Panitia ({panitiaParticipants.length})
			</button>
			<button
				type="button"
				class="btn shrink-0 snap-start whitespace-nowrap {tab ===
				'staff'
					? 'btn-gold'
					: ''}"
				onclick={() => (tab = "staff")}
			>
				Roster ({staffMembers.length})
			</button>
		</nav>

		{#if tab === "verify"}
			<section
				class="flex min-w-0 flex-col gap-3"
				aria-labelledby="verification-title"
			>
				<div
					class="flex min-w-0 flex-wrap items-end justify-between gap-3"
				>
					<div>
						<h1 id="verification-title" class="text-lg font-bold">
							Verifikasi pembayaran
						</h1>
						<p class="text-xs text-muted-foreground">
							Klik baris untuk melihat detail dan bukti
							pembayaran.
						</p>
					</div>
					<button
						type="button"
						class="btn btn-sm shrink-0"
						onclick={() => void load()}
						disabled={loading}
					>
						{#if loading}
							<Loader2
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							/>
						{:else}
							<RefreshCw class="h-4 w-4" aria-hidden="true" />
						{/if}
						Muat ulang
					</button>
				</div>

				<div class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
					<label
						class="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"
					>
						<span>Status pembayaran</span>
						<select
							class="input min-w-0"
							value={paymentStatusFilter}
							onchange={(event) => {
								paymentStatusFilter = event.currentTarget
									.value as PaymentStatus;
								paymentPage = 1;
							}}
						>
							{#each Object.entries(paymentStatusLabels) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
					</label>
					<label
						class="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"
					>
						<span>Metode pembayaran</span>
						<select
							class="input min-w-0"
							value={paymentMethodFilter}
							onchange={(event) => {
								paymentMethodFilter = event.currentTarget.value;
								paymentPage = 1;
							}}
						>
							<option value="all">Semua metode</option>
							{#each paymentMethods as method}
								<option value={method}
									>{methodLabel(method)}</option
								>
							{/each}
						</select>
					</label>
					<label
						class="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"
					>
						<span>Lomba</span>
						<select
							class="input min-w-0"
							value={paymentCompetitionFilter}
							onchange={(event) => {
								paymentCompetitionFilter =
									event.currentTarget.value;
								paymentPage = 1;
							}}
						>
							<option value="all">Semua lomba</option>
							{#each competitions as competition}
								<option value={competition.name}
									>{competition.name}</option
								>
							{/each}
						</select>
					</label>
				</div>

				{#snippet paymentCell({
					column,
					row,
				}: {
					column: Column<PaymentWithMeta>;
					row: PaymentWithMeta;
				})}
					{#if column.key === "participant"}
						<button
							type="button"
							class="text-left font-semibold hover:text-gold"
							onclick={(event) => {
								event.stopPropagation();
								openPayment(row);
							}}
						>
							{row.participantName}
						</button>
					{:else if column.key === "competition"}
						<span class="text-muted-foreground"
							>{row.competitionName}</span
						>
					{:else if column.key === "ticket"}
						<span class="font-mono text-xs text-muted-foreground"
							>{row.participantTicket}</span
						>
					{:else if column.key === "phone"}
						<span class="font-mono text-xs text-muted-foreground"
							>{row.participantPhone}</span
						>
					{:else if column.key === "amount"}
						<span class="font-mono tabular-nums"
							>Rp {Number(row.amount).toLocaleString(
								"id-ID",
							)}</span
						>
					{:else if column.key === "method"}
						<span
							class="inline-flex rounded-full border px-2 py-1 text-xs {methodTone(
								row.paymentMethod,
							)}">{methodLabel(row.paymentMethod)}</span
						>
					{:else if column.key === "status"}
						<span
							class="inline-flex rounded-full border px-2 py-1 text-xs {statusTone(
								row,
							)}">{statusLabel(row)}</span
						>
					{:else if column.key === "proof"}
						<span class="text-muted-foreground"
							>{hasProof(row) ? "Tersedia" : "Belum ada"}</span
						>
					{:else if column.key === "createdAt"}
						<span class="text-xs text-muted-foreground"
							>{formatDate(row.createdAt)}</span
						>
					{:else if column.key === "actions"}
						<div class="flex flex-wrap gap-2">
							{#if !row.isVerified}
								<button
									type="button"
									class="btn px-2 py-1 text-xs"
									onclick={(event) => {
										event.stopPropagation();
										openPaymentAction(row, "reject");
									}}
									disabled={actingPayment !== null}
								>
									<Ban
										class="h-3.5 w-3.5"
										aria-hidden="true"
									/>
									Tolak
								</button>
								<button
									type="button"
									class="btn btn-gold px-2 py-1 text-xs"
									onclick={(event) => {
										event.stopPropagation();
										openPaymentAction(row, "verify");
									}}
									disabled={actingPayment !== null}
								>
									<BadgeCheck
										class="h-3.5 w-3.5"
										aria-hidden="true"
									/>
									Verifikasi
								</button>
							{:else if canSettlePayment(row)}
								<button
									type="button"
									class="btn btn-gold px-2 py-1 text-xs"
									onclick={(event) => {
										event.stopPropagation();
										openPaymentAction(row, "settle");
									}}
									disabled={actingPayment !== null}
								>
									<Banknote
										class="h-3.5 w-3.5"
										aria-hidden="true"
									/>
									Lunas
								</button>
							{/if}
						</div>
					{:else}
						—
					{/if}
				{/snippet}
				<DataTable
					rows={filteredPayments}
					bind:columns={paymentTableColumns}
					bind:page={paymentPage}
					pageSize={PAGE_SIZE}
					keyField="id"
					exportFilename="verifikasi-pembayaran.csv"
					onrowclick={openPayment}
					cell={paymentCell}
				/>
			</section>
		{:else if tab === "competition"}
			<section
				class="flex min-w-0 flex-col gap-3"
				aria-labelledby="competition-title"
			>
				<div
					class="flex min-w-0 flex-wrap items-center justify-between gap-3"
				>
					<h1 id="competition-title" class="text-lg font-bold">
						Kompetisi dan babak
					</h1>
					<button
						type="button"
						class="btn btn-sm shrink-0"
						onclick={() => (showTerms = true)}
					>
						<Scale class="h-4 w-4" aria-hidden="true" />
						Syarat & Ketentuan
					</button>
				</div>
				{#each competitions as c (c.id)}
					<div
						class="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
					>
						<div
							class="flex min-w-0 flex-wrap items-center justify-between gap-2"
						>
							<label
								class="flex min-w-0 items-center gap-2 text-sm font-semibold"
							>
								<input
									type="checkbox"
									checked={c.isActive}
									onchange={(e) =>
										(c.isActive = e.currentTarget.checked)}
									class="h-4 w-4 accent-gold"
								/>
								<span class="break-words">{c.name}</span>
								<span
									class="shrink-0 rounded-full bg-border/50 px-2 py-0.5 text-xs font-normal"
									>{scoringModeLabels[c.scoringMode] ??
										c.scoringMode}</span
								>
							</label>
							<span class="shrink-0 text-xs text-muted-foreground"
								>Babak {c.currentRound}</span
							>
						</div>
						<div
							class="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-3"
						>
							<label class="flex min-w-0 flex-col gap-1">
								<span class="text-xs text-muted-foreground"
									>Biaya pendaftaran (Rp)</span
								>
								<input
									type="number"
									class="input min-w-0"
									value={c.fee}
									onchange={(e) =>
										(c.fee = Number(e.currentTarget.value))}
								/>
							</label>
							<label class="flex min-w-0 flex-col gap-1">
								<span class="text-xs text-muted-foreground"
									>DP minimal (Rp)</span
								>
								<input
									type="number"
									class="input min-w-0"
									value={c.minDp}
									onchange={(e) =>
										(c.minDp = Number(
											e.currentTarget.value,
										))}
								/>
							</label>
							<label class="flex min-w-0 flex-col gap-1">
								<span class="text-xs text-muted-foreground"
									>Kuota peserta</span
								>
								<input
									type="number"
									class="input min-w-0"
									value={c.totalQuota}
									onchange={(e) =>
										(c.totalQuota = Number(
											e.currentTarget.value,
										))}
								/>
								<span class="text-[11px] text-muted-foreground"
									>Jumlah orang, bukan tim.</span
								>
							</label>
							<label class="flex min-w-0 flex-col gap-1">
								<span class="text-xs text-muted-foreground"
									>Jenis lomba</span
								>
								<select
									class="input min-w-0"
									value={c.scoringMode}
									onchange={(e) =>
										(c.scoringMode = e.currentTarget
											.value as Competition["scoringMode"])}
								>
									<option value="terberat"
										>Ikan terberat</option
									>
									<option value="kumulatif"
										>Berat kumulatif</option
									>
									<option value="jackpot_pita"
										>Jackpot pita</option
									>
									<option value="layangan_aduan"
										>Aduan layangan</option
									>
									<option value="layangan_hias"
										>Layangan hias</option
									>
								</select>
							</label>
						</div>
						<div class="flex flex-wrap justify-end gap-2">
							<button
								type="button"
								class="btn"
								onclick={() => openRoundDialog(c)}
								disabled={c.scoringMode !== "layangan_aduan" ||
									advancing !== null}
								title={c.scoringMode !== "layangan_aduan"
									? "Hanya tersedia untuk aduan layangan"
									: "Mulai babak berikutnya"}
							>
								{#if advancing === c.id}<Loader2
										class="h-4 w-4 animate-spin"
										aria-hidden="true"
									/>{:else}<ArrowRight
										class="h-4 w-4"
										aria-hidden="true"
									/>{/if}
								Babak berikutnya
							</button>
							<button
								type="button"
								class="btn btn-gold"
								onclick={() => void saveComp(c)}
								disabled={savingId !== null}
							>
								<Save class="h-4 w-4" aria-hidden="true" />
								Simpan
							</button>
						</div>
					</div>
				{/each}
			</section>
		{:else if tab === "sponsor"}
			<section
				class="flex min-w-0 flex-col gap-4"
				aria-labelledby="sponsor-admin-title"
			>
				<div
					class="flex min-w-0 flex-wrap items-end justify-between gap-3"
				>
					<div>
						<h1 id="sponsor-admin-title" class="text-lg font-bold">
							Sponsor landing
						</h1>
						<p class="text-xs text-muted-foreground">
							Konten sponsor hanya URL gambar dan URL tujuan.
						</p>
					</div>
					<span
						class="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-200"
						>{sponsors.length} banner</span
					>
				</div>

				<form
					class="grid min-w-0 gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
					onsubmit={(event) => {
						event.preventDefault();
						void saveSponsorEntry();
					}}
				>
					<label class="flex min-w-0 flex-col gap-1 text-sm">
						<span class="text-xs text-muted-foreground"
							>Gambar banner (≤500 KB, dikompres)</span
						>
						<div class="flex min-w-0 items-stretch gap-2">
							<input
								type="file"
								accept="image/*"
								class="hidden"
								bind:this={sponsorFileInput}
								onchange={(e) =>
									handleSponsorImage(e.currentTarget)}
							/>
							<button
								type="button"
								class="btn min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2 text-xs"
								onclick={() => sponsorFileInput?.click()}
								disabled={sponsorSaving || sponsorUploading}
							>
								{#if sponsorUploading}
									<Loader2
										class="h-4 w-4 animate-spin"
										aria-hidden="true"
									/>
									<span>Mengompres & mengunggah…</span>
								{:else}
									<FileUp
										class="h-4 w-4"
										aria-hidden="true"
									/>
									<span
										>{sponsorImagePreview
											? "Ganti gambar"
											: "Pilih gambar"}</span
									>
								{/if}
							</button>
							{#if sponsorForm.imageUrl}
								<a
									href={sponsorForm.imageUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="btn shrink-0 px-3 py-2 text-xs"
								>
									<ExternalLink
										class="h-4 w-4"
										aria-hidden="true"
									/>
								</a>
							{/if}
						</div>
					</label>
					<label class="flex min-w-0 flex-col gap-1 text-sm">
						<span class="text-xs text-muted-foreground"
							>URL tujuan sponsor</span
						>
						<input
							type="url"
							class="input min-w-0"
							value={sponsorForm.url}
							oninput={(event) =>
								(sponsorForm.url = event.currentTarget.value)}
							placeholder="https://..."
							required
						/>
					</label>
					<div class="flex flex-wrap gap-2 sm:justify-end">
						{#if editingSponsorId}
							<button
								type="button"
								class="btn"
								onclick={resetSponsorForm}
								disabled={sponsorSaving || sponsorUploading}
								><X
									class="h-4 w-4"
									aria-hidden="true"
								/>Batal</button
							>
						{/if}
						<button
							type="submit"
							class="btn btn-gold"
							disabled={sponsorSaving || sponsorUploading}
						>
							{#if sponsorUploading}<Loader2
									class="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>{:else if sponsorSaving}<Loader2
									class="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>{:else if editingSponsorId}<Save
									class="h-4 w-4"
									aria-hidden="true"
								/>{:else}<Plus
									class="h-4 w-4"
									aria-hidden="true"
								/>{/if}
							{sponsorUploading
								? "Mengunggah…"
								: editingSponsorId
									? "Simpan perubahan"
									: "Tambah sponsor"}
						</button>
					</div>
				</form>

				{#if sponsorImagePreview}
					<img
						src={sponsorImagePreview}
						alt="Pratinjau gambar banner sponsor"
						class="aspect-[10/3] w-full rounded-xl border border-cyan-300/20 bg-black/20 object-cover"
					/>
				{/if}

				{#if sponsors.length === 0}
					<div
						class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
					>
						Belum ada sponsor. Tambahkan banner pertama.
					</div>
				{:else}
					<div
						class="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3"
					>
						{#each sponsors as sponsor (sponsor.id)}
							<article
								class="min-w-0 overflow-hidden rounded-xl border border-border bg-background/60"
							>
								<a
									href={sponsor.url}
									target="_blank"
									rel="noopener noreferrer"
									class="block border-b border-border bg-black/20"
								>
									<img
										src={sponsor.imageUrl}
										alt="Preview banner sponsor"
										class="aspect-[10/3] w-full object-cover"
										loading="lazy"
									/>
								</a>
								<div class="flex min-w-0 flex-col gap-3 p-3">
									<p
										class="break-all text-xs text-muted-foreground"
									>
										{sponsor.url}
									</p>
									<div class="flex flex-wrap gap-2">
										<a
											href={sponsor.url}
											target="_blank"
											rel="noopener noreferrer"
											class="btn flex-1 px-2 py-1 text-xs"
											><ExternalLink
												class="h-3.5 w-3.5"
												aria-hidden="true"
											/>Buka</a
										>
										<button
											type="button"
											class="btn px-2 py-1 text-xs"
											onclick={() => editSponsor(sponsor)}
											disabled={sponsorSaving ||
												deletingSponsorId !== null}
											><Pencil
												class="h-3.5 w-3.5"
												aria-hidden="true"
											/>Edit</button
										>
										<button
											type="button"
											class="btn btn-destructive px-2 py-1 text-xs"
											onclick={() =>
												void removeSponsor(sponsor)}
											disabled={sponsorSaving ||
												deletingSponsorId !== null}
											><Trash2
												class="h-3.5 w-3.5"
												aria-hidden="true"
											/>{deletingSponsorId === sponsor.id
												? "Menghapus…"
												: "Hapus"}</button
										>
									</div>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>
		{:else if tab === "panitia"}
			<section
				class="flex min-w-0 flex-col gap-4"
				aria-labelledby="panitia-title"
			>
				<div
					class="flex min-w-0 flex-wrap items-end justify-between gap-3"
				>
					<div>
						<h1 id="panitia-title" class="text-lg font-bold">
							Operasi panitia — check-in
						</h1>
						<p class="text-xs text-muted-foreground">
							Kelola status check-in, pembayaran, dan metode
							pelunasan peserta.
						</p>
					</div>
					<label class="flex min-w-0 flex-col gap-1 text-sm">
						<span class="text-xs text-muted-foreground"
							>Filter check-in</span
						>
						<select
							class="input min-w-0"
							bind:value={panitiaFilter}
						>
							<option value="all">Semua</option>
							<option value="belum">Belum check-in</option>
							<option value="sudah">Sudah check-in</option>
						</select>
					</label>
				</div>

				<div class="grid min-w-0 gap-2 sm:grid-cols-3">
					<div
						class="rounded-xl border border-border bg-background/60 p-3 text-center"
					>
						<p class="text-xs text-muted-foreground">
							Total peserta
						</p>
						<p class="mt-1 text-2xl font-bold tabular-nums">
							{panitiaParticipants.length}
						</p>
					</div>
					<div
						class="rounded-xl border border-emerald-300/25 bg-emerald-300/5 p-3 text-center"
					>
						<p class="text-xs text-emerald-200">Sudah check-in</p>
						<p
							class="mt-1 text-2xl font-bold tabular-nums text-emerald-200"
						>
							{panitiaParticipants.filter((p) => p.checkedIn)
								.length}
						</p>
					</div>
					<div
						class="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-center"
					>
						<p class="text-xs text-amber-200">Belum check-in</p>
						<p
							class="mt-1 text-2xl font-bold tabular-nums text-amber-200"
						>
							{panitiaParticipants.filter((p) => !p.checkedIn)
								.length}
						</p>
					</div>
				</div>

				{#if panitiaParticipants.length === 0}
					<div
						class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
					>
						Belum ada peserta terdaftar.
					</div>
				{:else}
					<div
						class="min-w-0 overflow-x-auto rounded-xl border border-border"
					>
						<table
							class="w-full min-w-[720px] border-collapse text-sm"
						>
							<thead>
								<tr
									class="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"
								>
									<th class="px-3 py-2 font-semibold"
										>Peserta</th
									>
									<th class="px-3 py-2 font-semibold"
										>Lomba</th
									>
									<th class="px-3 py-2 font-semibold"
										>Check-in</th
									>
									<th class="px-3 py-2 font-semibold"
										>Pembayaran</th
									>
									<th class="px-3 py-2 font-semibold"
										>Metode</th
									>
									<th class="px-3 py-2 font-semibold"
										>Sumber</th
									>
									<th class="px-3 py-2 font-semibold">Aksi</th
									>
								</tr>
							</thead>
							<tbody>
								{#each panitiaParticipants.filter((p) => panitiaFilter === "all" || (panitiaFilter === "sudah") === p.checkedIn) as row (row.participant.id)}
									<tr
										class="border-b border-border/60 last:border-0"
									>
										<td class="px-3 py-2">
											<p class="font-semibold">
												{row.participant.name}
											</p>
											<p
												class="text-xs text-muted-foreground"
											>
												{row.participant.ticketNumber}
											</p>
										</td>
										<td class="px-3 py-2 text-xs"
											>{row.competitionName}</td
										>
										<td class="px-3 py-2">
											{#if row.checkedIn}
												<span
													class="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-200"
													>Sudah</span
												>
											{:else}
												<span
													class="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200"
													>Belum</span
												>
											{/if}
										</td>
										<td class="px-3 py-2">
											{#if row.paidStatus === "full"}
												<span
													class="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-200"
													>Lunas</span
												>
											{:else if row.paidStatus === "dp"}
												<span
													class="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200"
													>DP</span
												>
											{:else}
												<span
													class="rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-0.5 text-xs text-rose-200"
													>Belum</span
												>
											{/if}
										</td>
										<td class="px-3 py-2 text-xs"
											>{row.paymentMethods.length > 0
												? row.paymentMethods
														.map(methodLabel)
														.join(", ")
												: "—"}</td
										>
										<td class="px-3 py-2 text-xs"
											>{row.participant.registrationSource ===
											"panitia"
												? `Panitia${row.participant.registeredByStaffName ? ` · ${row.participant.registeredByStaffName}` : ""}`
												: "Web"}</td
										>
										<td class="px-3 py-2">
											{#if row.checkedIn}
												<button
													type="button"
													class="btn btn-ghost px-2 py-1 text-xs"
													onclick={() =>
														void panitiaUndoCheckIn(
															row,
														)}
													disabled={panitiaSaving !==
														null}
													><Undo2
														class="h-3.5 w-3.5"
														aria-hidden="true"
													/>Batalkan</button
												>
											{:else if row.paidStatus === "none"}
												<!-- QW-4/A10: belum DP / ditolak / didiskualifikasi → check-in pasti
													 ditolak checkin.ts; nonaktifkan + alasan, bukan tombol yang gagal. -->
												<span
													class="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground"
													title="Belum memenuhi syarat masuk (minimal DP dibayar)"
												>
													<BadgeCheck
														class="h-3.5 w-3.5"
														aria-hidden="true"
													/>Belum layak
												</span>
											{:else}
												<button
													type="button"
													class="btn btn-gold px-2 py-1 text-xs"
													onclick={() =>
														void panitiaCheckIn(
															row,
														)}
													disabled={panitiaSaving !==
														null}
													><BadgeCheck
														class="h-3.5 w-3.5"
														aria-hidden="true"
													/>Check-in</button
												>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		{:else if tab === "staff"}
			<section
				class="flex min-w-0 flex-col gap-4"
				aria-labelledby="staff-admin-title"
			>
				<div>
					<h1 id="staff-admin-title" class="text-lg font-bold">
						Roster panitia & juri
					</h1>
					<p class="text-xs text-muted-foreground">
						Anggota login pakai 6 digit terakhir nomor HP di sini.
						Nonaktifkan alih-alih hapus — histori atribusi (siapa
						check-in/input skor) tetap terbaca.
					</p>
				</div>

				<form
					class="grid min-w-0 gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
					onsubmit={(event) => {
						event.preventDefault();
						void saveStaffEntry();
					}}
				>
					<label class="flex min-w-0 flex-col gap-1 text-sm">
						<span class="text-xs text-muted-foreground">Peran</span>
						<select class="input" bind:value={staffForm.role}>
							{#each staffRole as role (role)}
								<option value={role}
									>{role === "panitia" ? "Panitia" : "Juri"}</option
								>
							{/each}
						</select>
					</label>
					<label class="flex min-w-0 flex-col gap-1 text-sm">
						<span class="text-xs text-muted-foreground">Nama</span>
						<input
							type="text"
							class="input min-w-0"
							value={staffForm.name}
							oninput={(event) =>
								(staffForm.name = event.currentTarget.value)}
							placeholder="cth: Budi Panitia"
							required
						/>
					</label>
					<label class="flex min-w-0 flex-col gap-1 text-sm">
						<span class="text-xs text-muted-foreground">No. HP</span>
						<input
							type="tel"
							class="input min-w-0"
							value={staffForm.phone}
							oninput={(event) =>
								(staffForm.phone = event.currentTarget.value)}
							placeholder="081234567890"
							required
						/>
					</label>
					<div class="flex flex-wrap gap-2 sm:justify-end">
						{#if editingStaffId}
							<button
								type="button"
								class="btn"
								onclick={resetStaffForm}
								disabled={staffSaving}
								><X class="h-4 w-4" aria-hidden="true" />Batal</button
							>
						{/if}
						<button
							type="submit"
							class="btn btn-gold"
							disabled={staffSaving}
						>
							{#if staffSaving}
								<Loader2
									class="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
							{:else if editingStaffId}
								<Save class="h-4 w-4" aria-hidden="true" />
							{:else}
								<Plus class="h-4 w-4" aria-hidden="true" />
							{/if}
							{editingStaffId ? "Simpan perubahan" : "Tambah"}
						</button>
					</div>
				</form>
				{#if staffError}
					<p class="text-sm text-destructive" role="alert">{staffError}</p>
				{/if}

				{#if staffMembers.length === 0}
					<div
						class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
					>
						Belum ada anggota roster.
					</div>
				{:else}
					<div
						class="min-w-0 overflow-x-auto rounded-xl border border-border"
					>
						<table class="w-full min-w-[520px] border-collapse text-sm">
							<thead>
								<tr
									class="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"
								>
									<th class="px-3 py-2 font-semibold">Nama</th>
									<th class="px-3 py-2 font-semibold">Peran</th>
									<th class="px-3 py-2 font-semibold">No. HP</th>
									<th class="px-3 py-2 font-semibold">Status</th>
									<th class="px-3 py-2 font-semibold">Aksi</th>
								</tr>
							</thead>
							<tbody>
								{#each staffMembers as row (row.id)}
									<tr class="border-b border-border/60 last:border-0">
										<td class="px-3 py-2 font-semibold"
											>{row.name}</td
										>
										<td class="px-3 py-2 text-xs"
											>{row.role === "panitia" ? "Panitia" : "Juri"}</td
										>
										<td class="px-3 py-2 text-xs font-mono"
											>{row.phone}</td
										>
										<td class="px-3 py-2">
											{#if row.isActive}
												<span
													class="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-200"
													>Aktif</span
												>
											{:else}
												<span
													class="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground"
													>Nonaktif</span
												>
											{/if}
										</td>
										<td class="px-3 py-2">
											<div class="flex gap-1.5">
												<button
													type="button"
													class="btn btn-ghost px-2 py-1 text-xs"
													onclick={() => editStaff(row)}
													><Pencil
														class="h-3.5 w-3.5"
														aria-hidden="true"
													/>Edit</button
												>
												<button
													type="button"
													class="btn btn-ghost px-2 py-1 text-xs"
													onclick={() => void toggleStaffActive(row)}
													disabled={staffTogglingId !== null}
													>{row.isActive
														? "Nonaktifkan"
														: "Aktifkan"}</button
												>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		{:else}
			<section
				class="flex min-w-0 flex-col gap-3"
				aria-labelledby="payment-config-title"
			>
				<h1 id="payment-config-title" class="text-lg font-bold">
					Metode pembayaran
				</h1>
				{#each configs as cfg (cfg.id)}
					<div
						class="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
					>
						<label
							class="flex min-w-0 items-center gap-2 text-sm font-semibold"
						>
							<input
								type="checkbox"
								checked={cfg.isActive}
								onchange={(e) =>
									(cfg.isActive = e.currentTarget.checked)}
								class="h-4 w-4 accent-gold"
							/>
							<span class="break-words"
								>{methodLabel(cfg.method)}</span
							>
						</label>
						<div
							class="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2"
						>
							<label class="flex min-w-0 flex-col gap-1">
								<span class="text-xs text-muted-foreground"
									>Nama akun</span
								>
								<input
									type="text"
									class="input min-w-0"
									value={cfg.accountName ?? ""}
									onchange={(e) =>
										(cfg.accountName =
											e.currentTarget.value || null)}
								/>
							</label>
							<label class="flex min-w-0 flex-col gap-1">
								<span class="text-xs text-muted-foreground"
									>Nomor akun</span
								>
								<input
									type="text"
									class="input min-w-0"
									value={cfg.accountNumber ?? ""}
									onchange={(e) =>
										(cfg.accountNumber =
											e.currentTarget.value || null)}
								/>
							</label>
							<label
								class="flex min-w-0 flex-col gap-1 sm:col-span-2"
							>
								<span class="text-xs text-muted-foreground"
									>Instruksi pembayaran</span
								>
								<input
									type="text"
									class="input min-w-0"
									value={cfg.instructions ?? ""}
									onchange={(e) =>
										(cfg.instructions =
											e.currentTarget.value)}
								/>
							</label>
							{#if cfg.method === "qris"}
								<label
									class="flex min-w-0 flex-col gap-1 sm:col-span-2"
								>
									<span class="text-xs text-muted-foreground"
										>URL gambar QRIS</span
									>
									<input
										type="text"
										class="input min-w-0"
										value={cfg.qrisImageUrl ?? ""}
										onchange={(e) =>
											(cfg.qrisImageUrl =
												e.currentTarget.value || null)}
									/>
								</label>
							{/if}
						</div>
						<div class="flex justify-end">
							<button
								type="button"
								class="btn btn-gold"
								onclick={() => void saveConfig(cfg)}
								disabled={savingId !== null}
							>
								<Save class="h-4 w-4" aria-hidden="true" />
								Simpan
							</button>
						</div>
					</div>
				{/each}
			</section>
			<section
				class="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
				aria-labelledby="data-lock-title"
			>
				<div class="flex items-center justify-between gap-3">
					<div>
						<h2 id="data-lock-title" class="text-base font-bold">
							Data lock pasca-acara
						</h2>
						<p class="text-xs text-muted-foreground">
							Blokir semua perubahan data (pembayaran, skor,
							check-in, pendaftaran) setelah acara selesai.
						</p>
					</div>
					<button
						type="button"
						class="btn {dataLock.locked
							? 'btn-destructive'
							: 'btn-gold'} shrink-0"
						onclick={() => void toggleDataLock()}
						disabled={lockSaving}
					>
						{#if lockSaving}
							<Loader2
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							/>
						{:else}
							<Lock class="h-4 w-4" aria-hidden="true" />
						{/if}
						{dataLock.locked ? "Buka kunci" : "Kunci data"}
					</button>
				</div>
				{#if dataLock.locked}
					<p class="text-xs text-destructive" role="status">
						Data terkunci pada{" "}
						{dataLock.lockedAt?.toLocaleString("id-ID") ??
							"waktu tak dikenal"}.
					</p>
				{/if}
			</section>
		{/if}
	{/if}
</div>

{#if selectedPayment}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4"
	>
		<div
			class="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#0a0f1c] shadow-[0_0_40px_rgba(34,211,238,0.16)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="payment-dialog-title"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-4"
			>
				<div class="min-w-0">
					<p class="text-xs uppercase tracking-wider text-cyan-300">
						Detail pembayaran
					</p>
					<h2
						id="payment-dialog-title"
						class="break-words text-lg font-bold"
					>
						{selectedPayment.participantName}
					</h2>
				</div>
				<button
					type="button"
					class="btn shrink-0 px-2"
					aria-label="Tutup detail pembayaran"
					onclick={closePaymentModal}
					disabled={actingPayment !== null}
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
			<div class="min-h-0 overflow-y-auto px-4 py-4 sm:px-4">
				{#if paymentAction}
					<div
						class="mb-4 flex gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100"
						role="note"
					>
						<AlertTriangle
							class="mt-0.5 h-5 w-5 shrink-0"
							aria-hidden="true"
						/>
						<p>
							{paymentAction === "verify"
								? "Anda akan menandai pembayaran ini sebagai terverifikasi."
								: paymentAction === "settle"
									? `Kurang bayar Rp${remainingForParticipant(selectedPayment).toLocaleString("id-ID")} akan dicatat sebagai pembayaran tunai dan peserta menjadi lunas.`
									: "Anda akan menolak pembayaran ini dan menyimpan alasan penolakan."}
						</p>
					</div>
					{#if paymentAction === "settle" && settleHasPendingWarning(selectedPayment)}
						<div
							class="mb-4 flex gap-2 rounded-lg border border-rose-300/30 bg-rose-300/10 p-3 text-xs text-rose-200"
							role="alert"
						>
							<AlertTriangle
								class="mt-0.5 h-4 w-4 shrink-0"
								aria-hidden="true"
							/>
							<p>
								Peserta ini masih punya pembayaran pending yang
								bisa menutupi sisa. Verifikasi atau tolak dulu
								agar tidak double-charge.
							</p>
						</div>
					{/if}
				{/if}

				<div
					class="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background/40 p-3 text-sm sm:grid-cols-2"
				>
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">Lomba</p>
						<p class="break-words font-medium">
							{selectedPayment.competitionName}
						</p>
					</div>
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">Nominal</p>
						<p
							class="break-words font-mono font-medium tabular-nums"
						>
							Rp {Number(selectedPayment.amount).toLocaleString(
								"id-ID",
							)}
						</p>
					</div>
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">Metode</p>
						<p class="break-words font-medium">
							{methodLabel(selectedPayment.paymentMethod)}
						</p>
					</div>
					<div class="min-w-0">
						<p class="text-xs text-muted-foreground">Status</p>
						<p class="break-words font-medium">
							{statusLabel(selectedPayment)}
						</p>
					</div>
					<div class="min-w-0 sm:col-span-2">
						<p class="text-xs text-muted-foreground">
							Waktu pembayaran
						</p>
						<p class="break-words font-medium">
							{formatDate(selectedPayment.createdAt)}
						</p>
					</div>
				</div>

				<div class="mt-4">
					<p class="mb-2 text-sm font-semibold">Bukti pembayaran</p>
					{#if selectedPayment.proofImageUrl?.startsWith("http")}
						<img
							src={selectedPayment.proofImageUrl}
							alt="Bukti pembayaran {selectedPayment.participantName}"
							class="max-h-80 w-full rounded-xl border border-border/70 bg-black/30 object-contain"
						/>
					{:else if selectedPayment.proofImageUrl}
						<p
							class="rounded-xl border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground"
						>
							Bukti tersimpan sebagai draft dan belum dapat
							ditampilkan sebagai gambar.
						</p>
					{:else}
						<p
							class="rounded-xl border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground"
						>
							Belum ada bukti pembayaran.
						</p>
					{/if}
				</div>

				{#if selectedPayment.rejectReason}
					<div
						class="mt-4 rounded-xl border border-red-300/30 bg-red-300/10 p-3 text-sm"
					>
						<p class="text-xs text-red-200">
							Alasan penolakan sebelumnya
						</p>
						<p class="mt-1 break-words">
							{selectedPayment.rejectReason}
						</p>
					</div>
				{/if}

				{#if paymentAction === "reject"}
					<div class="mt-4 space-y-3">
						<label class="flex flex-col gap-1 text-sm">
							<span class="text-xs text-muted-foreground"
								>Template alasan penolakan</span
							>
							<select
								class="input min-w-0"
								aria-label="Template alasan penolakan"
								value={rejectionTemplate}
								onchange={(event) =>
									selectRejectionTemplate(
										event.currentTarget.value,
									)}
							>
								<option value="">Pilih template alasan</option>
								{#each rejectionReasonTemplates as template}
									<option value={template}>{template}</option>
								{/each}
								<option value={CUSTOM_REJECTION_REASON}
									>Lainnya — tulis manual</option
								>
							</select>
							<span class="text-[11px] text-muted-foreground"
								>Pilih template lalu sesuaikan teks bila
								diperlukan.</span
							>
						</label>
						<label class="flex flex-col gap-1 text-sm">
							<span class="text-xs text-muted-foreground"
								>Alasan penolakan</span
							>
							<textarea
								class="input min-h-24 resize-y"
								value={actionReason}
								oninput={(event) => {
									actionReason = event.currentTarget.value;
									rejectionTemplate = CUSTOM_REJECTION_REASON;
								}}
								placeholder="Pilih template atau tulis alasan penolakan."
							></textarea>
						</label>
					</div>
				{/if}

				{#if paymentActionError}
					<p
						class="mt-3 break-words text-sm text-destructive"
						role="alert"
					>
						{paymentActionError}
					</p>
				{/if}
			</div>
			<div
				class="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-4"
			>
				{#if paymentAction}
					<button
						type="button"
						class="btn"
						onclick={() => {
							paymentAction = null;
							paymentActionError = "";
							actionReason = "";
						}}
						disabled={actingPayment !== null}>Batal</button
					>
					{#if paymentAction === "verify"}
						<button
							type="button"
							class="btn btn-gold"
							onclick={() => void verify(selectedPayment!)}
							disabled={actingPayment !== null}
						>
							{#if actingPayment === selectedPayment.id}<Loader2
									class="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>{:else}<BadgeCheck
									class="h-4 w-4"
									aria-hidden="true"
								/>{/if}
							Konfirmasi verifikasi
						</button>
					{:else if paymentAction === "settle"}
						<button
							type="button"
							class="btn btn-gold"
							onclick={() => void settle(selectedPayment!)}
							disabled={actingPayment !== null}
						>
							{#if actingPayment === selectedPayment.id}<Loader2
									class="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>{:else}<Banknote
									class="h-4 w-4"
									aria-hidden="true"
								/>{/if}
							Konfirmasi lunas tunai
						</button>
					{:else}
						<button
							type="button"
							class="btn btn-destructive"
							onclick={() => void reject(selectedPayment!)}
							disabled={actingPayment !== null}
						>
							{#if actingPayment === selectedPayment.id}<Loader2
									class="h-4 w-4 animate-spin"
									aria-hidden="true"
								/>{:else}<Ban
									class="h-4 w-4"
									aria-hidden="true"
								/>{/if}
							Konfirmasi penolakan
						</button>
					{/if}
				{:else}
					{#if !selectedPayment.isVerified}
						<button
							type="button"
							class="btn"
							onclick={() =>
								openPaymentAction(selectedPayment!, "reject")}
							><Ban
								class="h-4 w-4"
								aria-hidden="true"
							/>Tolak</button
						>
					{:else if canSettlePayment(selectedPayment)}
						<button
							type="button"
							class="btn btn-gold"
							onclick={() =>
								openPaymentAction(selectedPayment!, "settle")}
							><Banknote
								class="h-4 w-4"
								aria-hidden="true"
							/>Lunas Rp {remainingForParticipant(
								selectedPayment,
							).toLocaleString("id-ID")}</button
						>
					{/if}
					{#if !selectedPayment.isVerified}
						<button
							type="button"
							class="btn btn-gold"
							onclick={() =>
								openPaymentAction(selectedPayment!, "verify")}
							><BadgeCheck
								class="h-4 w-4"
								aria-hidden="true"
							/>Verifikasi</button
						>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if importDialogOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4"
	>
		<div
			class="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#0a0f1c] shadow-[0_0_40px_rgba(34,211,238,0.16)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="participant-import-title"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wider text-cyan-300">
						Wizard import peserta
					</p>
					<h2 id="participant-import-title" class="text-lg font-bold">
						Import data peserta dari CSV
					</h2>
				</div>
				<button
					type="button"
					class="btn shrink-0 px-2"
					aria-label="Tutup wizard import peserta"
					onclick={closeImportDialog}
					disabled={importing}
					><X class="h-4 w-4" aria-hidden="true" /></button
				>
			</div>
			<div
				class="flex items-center gap-1 border-b border-border px-4 py-3 text-[11px] sm:px-4"
			>
				{#each ["Panduan", "Pilih file", "Pratinjau", "Selesai"] as label, index}
					<span
						class="flex items-center gap-1 {importStep === index + 1
							? 'font-semibold text-cyan-200'
							: importStep > index + 1
								? 'text-emerald-300'
								: 'text-muted-foreground'}"
						><span
							class="flex h-5 w-5 items-center justify-center rounded-full border border-current"
							>{index + 1}</span
						><span class="hidden sm:inline">{label}</span></span
					>
					{#if index < 3}<span class="h-px flex-1 bg-border"
						></span>{/if}
				{/each}
			</div>
			<div class="min-h-0 overflow-y-auto px-4 py-4 sm:px-4">
				{#if importStep === 1}
					<div class="space-y-4 text-sm">
						<div>
							<h3 class="font-semibold">Format CSV</h3>
							<p class="mt-1 text-xs text-muted-foreground">
								Kolom wajib: <code>nama</code>,
								<code>no_wa</code>, dan <code>lomba</code> atau
								<code>competition_id</code>. Kolom tiket dan
								lapak opsional.
							</p>
						</div>
						<pre
							class="overflow-x-auto rounded-xl border border-border bg-black/30 p-3 text-xs leading-6 text-cyan-100">nama,no_wa,lomba,nomor_tiket,nomor_lapak{"\n"}Budi,081234567890,Mancing Lele,RA-2026-101,1{"\n"}Sari,+628123456789,Aduan Layangan,,2</pre>
						<details
							class="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3"
							open
						>
							<summary
								class="cursor-pointer font-semibold text-amber-100"
								>Panduan edge case</summary
							>
							<ul
								class="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground"
							>
								<li>
									UTF-8 dengan BOM, delimiter koma, titik
									koma, dan tab didukung. Nilai yang
									mengandung delimiter harus diapit tanda
									kutip.
								</li>
								<li>
									Baris kosong dan kolom ekstra aman; kolom
									ekstra diabaikan dan diberi peringatan.
								</li>
								<li>
									Nomor WA harus format Indonesia (08…, 62…,
									atau +62…). Spasi dan tanda hubung
									dinormalisasi.
								</li>
								<li>
									Lomba harus sama dengan nama lomba atau
									memakai ID lomba. Nomor tiket dan WA+lomba
									tidak boleh duplikat.
								</li>
								<li>
									Kuota dicek sebelum import. Error wajib
									diperbaiki di CSV sebelum tombol import
									aktif.
								</li>
								<li>
									Status, pembayaran, lunas, dan verifikasi
									diabaikan. Peserta diimport sebagai
									terdaftar; status pembayaran tetap berasal
									dari transaksi.
								</li>
							</ul>
						</details>
					</div>
				{:else if importStep === 2}
					<div class="space-y-4">
						<label
							class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-cyan-300/40 bg-cyan-300/5 p-8 text-center"
							><FileUp
								class="h-8 w-8 text-cyan-300"
								aria-hidden="true"
							/><span class="font-semibold">Pilih file CSV</span
							><span class="text-xs text-muted-foreground"
								>Maksimal 5 MB</span
							><input
								type="file"
								accept=".csv,text/csv"
								class="sr-only"
								onchange={selectImportFile}
							/></label
						>{#if importFileName}<p
								class="rounded-lg border border-emerald-300/25 bg-emerald-300/5 p-3 text-sm text-emerald-100"
							>
								File dipilih: {importFileName}
							</p>{/if}{#if importFileError}<p
								class="text-sm text-destructive"
								role="alert"
							>
								{importFileError}
							</p>{/if}
					</div>
				{:else if importStep === 3}
					{#if importPreview}
						{@const importErrors = importPreview.issues.filter(
							(item) => item.level === "error",
						)}
						{@const importWarnings = importPreview.issues.filter(
							(item) => item.level === "warning",
						)}
						<div class="space-y-4 text-sm">
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
								<div
									class="rounded-lg border border-border p-3"
								>
									<p class="text-xs text-muted-foreground">
										Baris data
									</p>
									<p class="text-xl font-bold">
										{importPreview.dataRowCount}
									</p>
								</div>
								<div
									class="rounded-lg border border-border p-3"
								>
									<p class="text-xs text-muted-foreground">
										Siap import
									</p>
									<p
										class="text-xl font-bold text-emerald-300"
									>
										{importPreview.rows.length}
									</p>
								</div>
								<div
									class="rounded-lg border border-border p-3"
								>
									<p class="text-xs text-muted-foreground">
										Error
									</p>
									<p class="text-xl font-bold text-rose-300">
										{importErrors.length}
									</p>
								</div>
								<div
									class="rounded-lg border border-border p-3"
								>
									<p class="text-xs text-muted-foreground">
										Peringatan
									</p>
									<p class="text-xl font-bold text-amber-200">
										{importWarnings.length}
									</p>
								</div>
							</div>
							{#if importPreview.issues.length > 0}<div
									class="max-h-48 overflow-y-auto rounded-xl border border-border bg-black/20 p-3 text-xs"
								>
									{#each importPreview.issues as item}<p
											class="mb-1 {item.level === 'error'
												? 'text-rose-200'
												: 'text-amber-100'}"
										>
											Baris {item.row}: {item.message}
										</p>{/each}
								</div>{/if}{#if importPreview.rows.length > 0}<div
									class="overflow-x-auto rounded-xl border border-border"
								>
									<table class="w-full text-left text-xs">
										<thead
											class="border-b border-border bg-background/50"
											><tr
												><th class="px-2 py-2">Baris</th
												><th class="px-2 py-2">Nama</th
												><th class="px-2 py-2">WA</th
												><th class="px-2 py-2">Lomba</th
												><th class="px-2 py-2">Tiket</th
												></tr
											></thead
										><tbody
											>{#each importPreview.rows.slice(0, 10) as row}<tr
													class="border-b border-border/50"
													><td class="px-2 py-2"
														>{row.row}</td
													><td class="px-2 py-2"
														>{row.name}</td
													><td class="px-2 py-2"
														>{row.phone}</td
													><td class="px-2 py-2"
														>{competitions.find(
															(competition) =>
																competition.id ===
																row.competitionId,
														)?.name}</td
													><td class="px-2 py-2"
														>{row.ticketNumber ??
															"Otomatis"}</td
													></tr
												>{/each}</tbody
										>
									</table>
								</div>
								{#if importPreview.rows.length > 10}<p
										class="text-xs text-muted-foreground"
									>
										Menampilkan 10 baris pertama dari {importPreview
											.rows.length} baris valid.
									</p>{/if}{/if}{#if importFileError}<p
									class="text-sm text-destructive"
									role="alert"
								>
									{importFileError}
								</p>{/if}
						</div>
					{/if}
				{:else if importResult}<div class="space-y-4 text-sm">
						<div
							class="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-emerald-100"
						>
							<p class="font-semibold">Import selesai</p>
							<p class="mt-1">
								{importResult.imported} peserta berhasil ditambahkan.
								{importResult.skipped} baris dilewati.
							</p>
						</div>
						{#if importResult.issues.length > 0}<div
								class="rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-xs text-amber-100"
							>
								{#each importResult.issues as item}<p>
										Baris {item.row}: {item.message}
									</p>{/each}
							</div>{/if}
					</div>{/if}
			</div>
			<div
				class="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3 sm:px-4"
			>
				{#if importStep === 1}<span></span><button
						type="button"
						class="btn btn-gold"
						onclick={() => (importStep = 2)}
						>Lanjut pilih file</button
					>
				{:else if importStep === 2}<button
						type="button"
						class="btn"
						onclick={() => (importStep = 1)}>Kembali</button
					><button
						type="button"
						class="btn btn-gold"
						onclick={() => void readImportFile()}
						disabled={!importFile}>Baca dan validasi CSV</button
					>
				{:else if importStep === 3}<button
						type="button"
						class="btn"
						onclick={() => (importStep = 2)}
						disabled={importing}>Ganti file</button
					><button
						type="button"
						class="btn btn-gold"
						onclick={() => void runParticipantImport()}
						disabled={importing ||
							!importPreview ||
							importPreview.rows.length === 0 ||
							importPreview.issues.some(
								(item) => item.level === "error",
							)}
						>{#if importing}<Loader2
								class="h-4 w-4 animate-spin"
								aria-hidden="true"
							/>{/if}Import {importPreview?.rows.length ?? 0} peserta</button
					>
				{:else}<span></span><button
						type="button"
						class="btn btn-gold"
						onclick={closeImportDialog}>Selesai</button
					>{/if}
			</div>
		</div>
	</div>
{/if}

<TermsDialog
	open={showTerms}
	title="Syarat & Ketentuan"
	onclose={() => (showTerms = false)}
/>

{#if roundCompetition}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4"
	>
		<div
			class="w-full max-w-lg rounded-2xl border border-red-300/30 bg-[#0a0f1c] shadow-[0_0_40px_rgba(220,38,38,0.18)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="round-dialog-title"
		>
			<div
				class="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-4"
			>
				<div>
					<p class="text-xs uppercase tracking-wider text-red-200">
						Konfirmasi tindakan panitia
					</p>
					<h2 id="round-dialog-title" class="text-lg font-bold">
						Mulai babak berikutnya?
					</h2>
				</div>
				<button
					type="button"
					class="btn px-2"
					aria-label="Tutup konfirmasi babak"
					onclick={closeRoundDialog}
					disabled={advancing !== null}
					><X class="h-4 w-4" aria-hidden="true" /></button
				>
			</div>
			{#if forceAdvance}
				<div
					class="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-red-100"
				>
					<p class="font-semibold">
						{unjudgedCount} peserta belum dinilai pada babak
						{roundCompetition.currentRound}.
					</p>
					<p class="mt-1">
						Lanjutkan tetap? Skor yang belum masuk akan tertinggal
						di babak lama.
					</p>
				</div>
			{:else}<div class="space-y-3 px-4 py-4 text-sm sm:px-4">
					<div
						class="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-red-100"
					>
						<p class="font-semibold">Apa yang akan terjadi?</p>
						<p class="mt-1">
							{roundCompetition.name} akan berpindah dari babak {roundCompetition.currentRound}
							ke babak {roundCompetition.currentRound + 1}.
							Leaderboard babak aduan yang sedang berjalan akan
							mulai membaca babak baru.
						</p>
					</div>
					<ul class="list-disc space-y-1 pl-5 text-muted-foreground">
						<li>Pastikan semua skor babak saat ini sudah final.</li>
						<li>Tindakan ini tidak memiliki undo otomatis.</li>
						<li>
							Jika salah menekan, panitia perlu mengembalikan
							nomor babak melalui konfigurasi atau database.
						</li>
					</ul>
				</div>{/if}
			<div
				class="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-4"
			>
				<button
					type="button"
					class="btn"
					onclick={closeRoundDialog}
					disabled={advancing !== null}>Batal</button
				>
				<button
					type="button"
					class="btn btn-destructive"
					onclick={() => void nextRound()}
					disabled={advancing !== null}
				>
					{#if advancing !== null}<Loader2
							class="h-4 w-4 animate-spin"
							aria-hidden="true"
						/>{/if}
					Ya, mulai babak {roundCompetition.currentRound + 1}
					{#if forceAdvance}
						(paksa){/if}
				</button>
			</div>
		</div>
	</div>
{/if}
