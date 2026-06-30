// Firebase config is loaded from firebase-config.js (gitignored).
// Copy firebase-config.example.js → firebase-config.js and fill in your values.
if (!window.APP_CONFIG) {
  throw new Error('APP_CONFIG not found. Please create firebase-config.js from firebase-config.example.js.');
}
firebase.initializeApp(window.APP_CONFIG.firebase);
const db = firebase.firestore();

const App = {
  // State
  events: [],
  bookings: [],
  waitlists: [],
  isAdmin: false,
  currentFilter: 'all',
  eventsLimit: 9,
  socials: { facebook: '', instagram: '', twitter: '' },
  cloudinary: { name: '', preset: '' },
  unsplashAccessKey: (window.APP_CONFIG || {}).unsplashAccessKey || '',
  geminiApiKey: (window.APP_CONFIG || {}).geminiApiKey || '',
  activityLogs: [],
  selectedEvents: new Set(),
  deleteCallback: null,
  lastTicketData: null,
  pendingBooking: null, // For confirmation step
  scannerInstance: null,
  lastScannedCode: null,
  scanTimeout: null,

  // ===================== XSS PROTECTION =====================
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Initialize
  init() {
    // Initialize Analytics
    if (window.firebase && firebase.analytics) {
      try { firebase.analytics(); } catch (e) {}
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.log('SW registration failed: ', err);
        });
      });
    }

    // Apply saved theme
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }

    // Load settings from local storage
    const savedSocials = localStorage.getItem('uv_socials');
    if (savedSocials) this.socials = JSON.parse(savedSocials);
    
    const savedCloudinary = localStorage.getItem('uv_cloudinary');
    if (savedCloudinary) this.cloudinary = JSON.parse(savedCloudinary);

    const savedUnsplash = localStorage.getItem('uv_unsplash');
    if (savedUnsplash) this.unsplashAccessKey = savedUnsplash;

    const savedGemini = localStorage.getItem('uv_gemini');
    if (savedGemini) this.geminiApiKey = savedGemini;

    this.renderNavAuth();
    this.loadData();
    this.setupParticles();
    this.setupScrollReveal();
    this.setupModalBehavior();
    // this.checkRoute() is now called by loadData once events load from Firestore
    this.renderSocials();
    window.addEventListener('hashchange', () => this.checkRoute());
    // Set min date for event creation to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('eventDate');
    if (dateInput) dateInput.min = today;
  },

  renderNavAuth() {
    const desktopNav = document.getElementById('authNavDesktop');
    const mobileDrop = document.getElementById('mobileNavDrop');
    
    const authHtmlDesktop = `
      <button onclick="App.toggleDarkMode()" class="text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)] transition-colors mr-3" id="themeToggleBtnDesk"><i class="fas fa-moon"></i></button>
      <button onclick="App.showMyBookings()" class="text-sm font-semibold text-[var(--accent)] hover:text-black transition-colors"><i class="fas fa-ticket"></i> My Tickets</button>
    `;
    const authHtmlMobile = `
      <button onclick="App.filterEvents('all'); window.scrollTo({top: document.getElementById('events-section').offsetTop - 80, behavior: 'smooth'}); App.closeMobileNav()" class="block w-full text-left text-sm font-bold text-black py-2 cursor-pointer dark:text-white">Browse All Events</button>
      <button onclick="App.toggleDarkMode();App.closeMobileNav()" class="block w-full text-left text-sm font-bold text-black py-2 cursor-pointer dark:text-white" id="themeToggleBtnMob">Toggle Dark Mode</button>
      <button onclick="App.showMyBookings();App.closeMobileNav()" class="btn-primary btn-sm w-full mt-2"><i class="fas fa-ticket"></i> My Tickets</button>
    `;
    if (desktopNav) desktopNav.innerHTML = authHtmlDesktop;
    if (mobileDrop) mobileDrop.innerHTML = authHtmlMobile;
  },

  // Load data from Firestore
  loadData() {
    const auth = window.firebase && firebase.auth ? firebase.auth() : null;
    if (auth) {
      auth.onAuthStateChanged(user => {
        if (user) {
          this.isAdmin = true;
          if (window.location.pathname.endsWith('admin.html')) {
            this.renderAdminStats();
            this.renderAdminEvents();
          }
        } else {
          this.isAdmin = false;
        }
      });
    }

    // Listen to Waitlists
    db.collection('waitlists').onSnapshot(snapshot => {
      this.waitlists = [];
      snapshot.forEach(doc => this.waitlists.push({ id: doc.id, ...doc.data() }));
      if (this.isAdmin && window.location.pathname.endsWith('admin.html')) {
        this.renderAdminStats();
        this.renderAdminWaitlist();
      }
    });

    // Listen to Bookings
    db.collection('bookings').onSnapshot(snapshot => {
      this.bookings = [];
      snapshot.forEach(doc => this.bookings.push({ id: doc.id, ...doc.data() }));
      if (this.isAdmin && window.location.pathname.endsWith('admin.html')) {
        this.renderAdminStats();
        this.renderRecentBookings();
        this.renderAdminBookings();
      }
    });

    // Listen to Events
    db.collection('events').onSnapshot(snapshot => {
      this.events = [];
      snapshot.forEach(doc => this.events.push({ id: doc.id, ...doc.data() }));
      
      this.renderEvents();
      if (this.isAdmin && window.location.pathname.endsWith('admin.html')) {
        this.renderAdminEvents();
        this.renderAdminBookings(); // Tiers might have changed
        this.renderAdminWaitlist(); // Event titles might have changed
      }
      this.checkRoute(); // Render based on route once loaded
    });

    // Listen to Activity Logs
    db.collection('activityLogs').onSnapshot(snapshot => {
      this.activityLogs = [];
      snapshot.forEach(doc => this.activityLogs.push({ id: doc.id, ...doc.data() }));
      this.activityLogs.sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));
      this.renderActivityLogs();
    });
  },



  // Generate unique ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  // Generate ticket code (iterative, not recursive)
  genTicketCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let attempts = 0;
    do {
      code = 'UV-';
      for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
      attempts++;
    } while (this.bookings.some(b => b.ticketCode === code) && attempts < 1000);
    return code;
  },

  // ===================== ROUTING =====================
  checkRoute() {
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    const isAdmin = window.location.pathname.endsWith('admin.html');
    
    if (isAdmin) {
      if (this.isAdmin) {
        this.showPage('pageAdmin');
      } else {
        this.showPage('pageAdminLogin');
      }
    } else {
      this.showPage('pageLanding');
      this.renderEvents();
      this.updateHeroStats();
      
      // Check for Promo QR Code event param
      const urlParams = new URLSearchParams(window.location.search);
      const promoEventId = urlParams.get('event');
      if (promoEventId) {
        setTimeout(() => this.showEventDetail(promoEventId), 300);
      }
    }
  },

  navigate(page) {
    if (page === 'landing') {
      window.location.href = 'index.html';
    } else if (page === 'admin-login') {
      window.location.href = 'admin.html';
    }
  },

  // Smooth scroll to section (fixes anchor vs hash routing conflict)
  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');

    if (pageId === 'pageLanding') {
      this.renderEvents();
      this.updateHeroStats();
      window.scrollTo(0, 0);
    } else if (pageId === 'pageAdmin') {
      this.renderAdminDashboard();
    }
  },

  showMyBookings() {
    this.closeMobileNav();
    this.openModal('myBookingsModal');
    document.getElementById('bookingsResult').innerHTML = '';
    document.getElementById('lookupPhone').value = '';
  },

  closeMyBookings() {
    this.closeModal('myBookingsModal');
  },

  lookupBookings() {
    const phoneInput = document.getElementById('lookupPhone').value.trim();
    if (!phoneInput) {
      this.toast('Please enter a phone number', 'error');
      return;
    }
    
    // Normalize phone
    let phone = phoneInput.replace(/\s/g, '');
    if (phone.startsWith('+254')) phone = '0' + phone.slice(4);
    else if (phone.startsWith('254')) phone = '0' + phone.slice(3);
    else if (!phone.startsWith('0')) phone = '0' + phone;

    const userBookings = this.bookings.filter(b => b.phone === phone);
    const container = document.getElementById('bookingsResult');
    
    if (userBookings.length === 0) {
      container.innerHTML = `<p class="text-sm text-[var(--muted)] text-center py-4">No bookings found for this number.</p>`;
      return;
    }

    userBookings.sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));
    
    container.innerHTML = userBookings.map(b => {
      const event = this.events.find(e => e.id === b.eventId);
      if (!event) return '';
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(b.ticketCode)}`;
      const isEnded = new Date(event.date + 'T23:59:59') < new Date();
      const isCancelled = b.cancelled === true;
      const statusBadge = isCancelled
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600"><i class="fas fa-ban"></i> Cancelled</span>`
        : isEnded
          ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"><i class="fas fa-clock"></i> Ended</span>`
          : `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><i class="fas fa-check"></i> Active</span>`;
      return `
        <div class="p-4 border border-[var(--border)] rounded-xl bg-[var(--card)] mb-3 ${isCancelled ? 'opacity-60' : ''}">
          <div class="flex items-center gap-4">
            <img src="${qrUrl}" alt="QR" class="w-12 h-12 rounded bg-white p-1 border shrink-0">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-0.5">
                <h5 class="font-bold text-sm truncate">${this.esc(event.title)}</h5>
                ${statusBadge}
              </div>
              <p class="text-xs text-[var(--muted)]">📅 ${this.formatDate(event.date)} &middot; 🎫 <span class="font-bold text-[var(--accent)]">${b.ticketCode}</span></p>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button onclick="App.showTicketDetail('${b.ticketCode}')" class="btn-secondary btn-sm flex-1 justify-center"><i class="fas fa-eye text-xs"></i> View</button>
            ${!isCancelled && !isEnded ? `<button onclick="App.cancelBooking('${b.ticketCode}')" class="btn-sm flex-1 justify-center text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg font-semibold transition-colors text-xs"><i class="fas fa-ban text-xs"></i> Cancel Ticket</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  showTicketDetail(ticketCode) {
    const booking = this.bookings.find(b => b.ticketCode === ticketCode);
    if (!booking) return;
    const event = this.events.find(e => e.id === booking.eventId);
    if (!event) return;
    this.closeMyBookings();
    this.showTicket(booking, event);
  },

  // ===================== TICKET CANCELLATION =====================
  cancelBooking(ticketCode) {
    const booking = this.bookings.find(b => b.ticketCode === ticketCode);
    if (!booking) { this.toast('Booking not found', 'error'); return; }
    const event = this.events.find(e => e.id === booking.eventId);
    if (!event) { this.toast('Event not found', 'error'); return; }

    // Populate the confirmation modal
    const tier = (event.tiers || []).find(t => t.id === booking.tierId) || {};
    document.getElementById('cancelTicketCode').textContent = ticketCode;
    document.getElementById('cancelEventTitle').textContent = event.title;
    document.getElementById('cancelEventDate').textContent = this.formatDate(event.date);
    document.getElementById('cancelTierName').textContent = tier.name || 'Standard';
    document.getElementById('confirmCancelBtn').setAttribute('data-ticket', ticketCode);

    this.openModal('cancelBookingModal');
  },

  confirmCancelBooking() {
    const btn = document.getElementById('confirmCancelBtn');
    const ticketCode = btn.getAttribute('data-ticket');
    if (!ticketCode) return;

    const booking = this.bookings.find(b => b.ticketCode === ticketCode);
    if (!booking) { this.toast('Booking not found', 'error'); return; }
    const event = this.events.find(e => e.id === booking.eventId);
    if (!event) { this.toast('Event not found', 'error'); return; }

    const origHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
    btn.disabled = true;

    // Batch: mark booking cancelled + decrement tier bookedSlots
    const batch = db.batch();

    // 1. Soft-delete booking (mark cancelled)
    const bookingRef = db.collection('bookings').doc(booking.id);
    batch.update(bookingRef, { cancelled: true, cancelledAt: new Date().toISOString() });

    // 2. Decrement bookedSlots on the relevant tier
    const tier = (event.tiers || []).find(t => t.id === booking.tierId);
    if (tier && tier.bookedSlots > 0) {
      tier.bookedSlots = Math.max(0, tier.bookedSlots - 1);
      const eventRef = db.collection('events').doc(event.id);
      batch.update(eventRef, { tiers: event.tiers });
    }

    batch.commit().then(() => {
      this.closeModal('cancelBookingModal');
      this.toast('Your ticket has been cancelled successfully.', 'success');
      // Refresh the My Tickets list
      setTimeout(() => this.lookupBookings(), 400);
    }).catch(err => {
      console.error('Cancellation error:', err);
      this.toast('Failed to cancel booking. Please try again.', 'error');
      btn.innerHTML = origHtml;
      btn.disabled = false;
    });
  },

  closeCancelModal() {
    this.closeModal('cancelBookingModal');
  },

  // ===================== LEGAL MODALS =====================
  openTerms() {
    this.closeModal('privacyModal');
    this.openModal('termsModal');
  },

  closeTerms() {
    this.closeModal('termsModal');
  },

  openPrivacy() {
    this.closeModal('termsModal');
    this.openModal('privacyModal');
  },

  closePrivacy() {
    this.closeModal('privacyModal');
  },

  // ===================== MODAL BEHAVIOR =====================
  setupModalBehavior() {
    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('show');
          document.body.classList.remove('modal-open');
        }
      });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(overlay => {
          overlay.classList.remove('show');
        });
        document.body.classList.remove('modal-open');
      }
    });
  },

  openModal(id) {
    document.getElementById(id).classList.add('show');
    document.body.classList.add('modal-open');
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('show');
    // Only remove modal-open if no other modals are open
    if (!document.querySelector('.modal-overlay.show')) {
      document.body.classList.remove('modal-open');
    }
  },


  // ===================== PARTICLES =====================
  setupParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (6 + Math.random() * 8) + 's';
      p.style.animationDelay = Math.random() * 6 + 's';
      p.style.width = (2 + Math.random() * 3) + 'px';
      p.style.height = p.style.width;
      p.style.background = Math.random() > 0.5 ? 'var(--accent)' : 'var(--accent2)';
      container.appendChild(p);
    }
  },

  // ===================== SCROLL REVEAL =====================
  setupScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  },

  // ===================== TOAST =====================
  toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${this.esc(message)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  // ===================== HERO STATS =====================
  updateHeroStats() {
    const activeEvents = this.events.filter(e => e.active);
    const totalBookings = this.bookings.length;
    const schools = new Set(this.events.filter(e => e.type === 'school' && e.school).map(e => e.school));

    this.animateCounter('heroEventCount', activeEvents.length);
    this.animateCounter('heroBookingCount', totalBookings);
    this.animateCounter('heroSchoolCount', schools.size);
  },

  animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(interval); }
      el.textContent = current;
    }, 30);
  },

  // ===================== EVENT FILTERING & RENDER =====================
  handleSearch() {
    this.eventsLimit = 9;
    this.renderEvents();
    this.renderSuggestions('eventSearchInput', 'searchSuggestions', 'searchSuggestionsList');
    this.renderSuggestions('eventSearchInput2', 'searchSuggestions2', 'searchSuggestionsList2');
  },

  renderSuggestions(inputId, boxId, listId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    const list = document.getElementById(listId);
    if (!input || !box || !list) return;

    const q = input.value.trim();
    if (!q) {
      box.classList.add('hidden');
      return;
    }

    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escapedQ, 'i');

    let matches = this.events.filter(e => e.active && (
      regex.test(e.title) ||
      regex.test(e.venue) ||
      (e.school && regex.test(e.school))
    )).slice(0, 5); // Limit to top 5 matches

    if (matches.length === 0) {
      list.innerHTML = `<li class="p-4 text-sm text-[var(--muted)] text-center">No matches found</li>`;
    } else {
      list.innerHTML = matches.map(e => {
        const imgSrc = e.image && e.image.startsWith('http') ? e.image : `https://picsum.photos/seed/${encodeURIComponent(e.image || e.title.replace(/\s/g, ''))}/100/100.jpg`;
        return `
        <li class="p-3 border-b border-[var(--border)] hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors" onclick="App.showEventDetail('${e.id}')">
          <div class="w-12 h-12 rounded-lg bg-gray-100 shrink-0 overflow-hidden relative">
             <img src="${imgSrc}" loading="lazy" class="w-full h-full object-cover" onerror="this.style.display='none'">
          </div>
          <div class="overflow-hidden flex-1 text-left">
            <h4 class="font-bold text-sm text-black truncate">${this.esc(e.title)}</h4>
            <p class="text-xs text-[var(--muted)] truncate"><i class="far fa-calendar text-[var(--accent2)]"></i> ${this.formatDate(e.date)} &bull; ${this.esc(e.venue)}</p>
          </div>
        </li>
        `;
      }).join('');
    }
    box.classList.remove('hidden');
  },

  loadMoreEvents() {
    this.eventsLimit += 9;
    this.renderEvents();
  },

  filterEvents(filter) {
    this.currentFilter = filter;
    this.eventsLimit = 9;

    // Update active chip highlight
    document.querySelectorAll('.cat-chip').forEach(btn => btn.classList.remove('active'));
    const chipId = 'chip-' + filter;
    const activeChip = document.getElementById(chipId);
    if (activeChip) activeChip.classList.add('active');

    this.renderEvents();
  },

  renderEvents() {
    const grid = document.getElementById('eventsGrid');
    const noMsg = document.getElementById('noEventsMsg');
    if (!grid) return;

    let filtered = this.events.filter(e => e.active);
    if (this.currentFilter === 'school') filtered = filtered.filter(e => e.type === 'school');
    else if (this.currentFilter === 'normal') filtered = filtered.filter(e => e.type === 'normal');
    else if (this.currentFilter === 'free') filtered = filtered.filter(e => {
      const minPrice = (e.tiers || []).reduce((min, t) => t.price < min ? t.price : min, Infinity);
      return minPrice === 0;
    });

    // Search filter
    const searchInput = document.getElementById('eventSearchInput');
    if (searchInput && searchInput.value.trim()) {
      const q = searchInput.value.trim();
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('\\b' + escapedQ, 'i');
      filtered = filtered.filter(e =>
        regex.test(e.title) ||
        regex.test(e.venue) ||
        (e.school && regex.test(e.school)) ||
        regex.test(e.description)
      );
    }

    // Sort
    // Sort — featured always first, then by selected filter
    if (this.currentFilter === 'trending') {
      filtered.sort((a, b) => {
        if (!!a.featured !== !!b.featured) return b.featured ? 1 : -1;
        const bookedA = (a.tiers || []).reduce((sum, t) => sum + t.bookedSlots, 0);
        const bookedB = (b.tiers || []).reduce((sum, t) => sum + t.bookedSlots, 0);
        return bookedB - bookedA;
      });
    } else {
      filtered.sort((a, b) => {
        if (!!a.featured !== !!b.featured) return b.featured ? 1 : -1;
        return new Date(a.date) - new Date(b.date);
      });
    }

    const totalFiltered = filtered.length;
    const paginated = filtered.slice(0, this.eventsLimit);

    if (paginated.length === 0) {
      grid.innerHTML = '';
      noMsg.classList.remove('hidden');
      const countEl = document.getElementById('eventsCountText');
      if (countEl) countEl.textContent = '0 events';
      const loadMore = document.getElementById('loadMoreContainer');
      if (loadMore) loadMore.classList.add('hidden');
      return;
    }

    noMsg.classList.add('hidden');
    const countEl = document.getElementById('eventsCountText');
    if (countEl) countEl.textContent = `Showing ${paginated.length} of ${totalFiltered} events`;
    grid.innerHTML = paginated.map(event => {
      const totalSlots = (event.tiers || []).reduce((sum, t) => sum + t.totalSlots, 0);
      const bookedSlots = (event.tiers || []).reduce((sum, t) => sum + t.bookedSlots, 0);
      const minPrice = (event.tiers || []).reduce((min, t) => t.price < min ? t.price : min, Infinity);
      
      const isFull = bookedSlots >= totalSlots;
      const slotsLeft = totalSlots - bookedSlots;
      const isEnded = new Date(event.date + 'T23:59:59') < new Date();
      const imgSeed = event.image || event.title.replace(/\s/g, '');
      const priceTag = minPrice > 0 && minPrice !== Infinity ? `KES ${minPrice.toLocaleString()}` : 'Free';
      const dateFormatted = this.formatDate(event.date);
      const timeFormatted = this.formatTime(event.time);
      const pct = Math.round((bookedSlots / totalSlots) * 100);
      const barColor = pct >= 100 ? 'var(--accent)' : pct >= 80 ? 'var(--accent2)' : 'var(--success)';

      let statusBadge = '';
      if (isEnded) statusBadge = '<span class="badge badge-ended"><i class="fas fa-clock"></i> Ended</span>';
      else if (isFull) statusBadge = '<span class="badge badge-full"><i class="fas fa-ban"></i> Fully Booked</span>';
      else if (slotsLeft <= 20) statusBadge = `<span class="badge badge-full urgency"><i class="fas fa-fire"></i> ${slotsLeft} slots left</span>`;
      else statusBadge = `<span class="badge badge-slots"><i class="fas fa-check"></i> ${slotsLeft} slots available</span>`;

      const typeBadge = event.type === 'school'
        ? `<span class="badge badge-school"><i class="fas fa-building-columns"></i> ${this.esc(event.school ? event.school.replace('School of ', '') : 'School')}</span>`
        : `<span class="badge badge-normal"><i class="fas fa-globe"></i> Open Event</span>`;

      const gridImgSrc = event.image && event.image.startsWith('http') ? event.image : `https://picsum.photos/seed/${encodeURIComponent(imgSeed)}/600/400.jpg`;

      return `
        <div class="cursor-pointer group reveal visible flex flex-col" onclick="App.showEventDetail('${event.id}')">
          <div class="w-full h-[260px] rounded-2xl overflow-hidden mb-4 relative shadow-sm border border-black/5">
            <img src="${gridImgSrc}" alt="${this.esc(event.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="img-fallback w-full h-full" style="display:none"><i class="fas fa-calendar-day"></i></div>
            <div class="absolute top-3 left-3 flex flex-wrap gap-2">
              ${event.featured ? '<span class="badge" style="background:rgba(255,182,39,0.92);color:#000;font-weight:800;border:none"><i class="fas fa-star"></i> Featured</span>' : ''}
              ${typeBadge}
            </div>
            <div class="absolute bottom-3 right-3">
              <div class="bg-white/95 backdrop-blur-md text-black text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-sm">
                ${priceTag}
              </div>
            </div>
          </div>
          <h3 class="font-bold text-lg text-black mb-2 leading-tight group-hover:text-[var(--accent)] transition-colors">${this.esc(event.title)}</h3>
          <div class="flex items-center text-sm text-[var(--muted)] mb-1.5">
            <i class="far fa-calendar w-5 text-center text-[var(--accent2)]"></i> ${dateFormatted} &middot; ${timeFormatted}
          </div>
          <div class="flex items-start text-sm text-[var(--muted)]">
            <i class="fas fa-location-dot w-5 text-center mt-0.5 text-[var(--accent2)]"></i> <span class="flex-1">${this.esc(event.venue)}</span>
          </div>
        </div>
      `;
    }).join('');

    const loadMore = document.getElementById('loadMoreContainer');
    if (loadMore) {
      if (this.eventsLimit < totalFiltered) {
        loadMore.classList.remove('hidden');
      } else {
        loadMore.classList.add('hidden');
      }
    }
  },



  // ===================== EVENT DETAIL MODAL =====================
  showEventDetail(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;

    const isFull = event.bookedSlots >= event.totalSlots;
    const isEnded = new Date(event.date + 'T23:59:59') < new Date();
    const slotsLeft = event.totalSlots - event.bookedSlots;
    const pct = Math.round((event.bookedSlots / event.totalSlots) * 100);
    const barColor = pct >= 100 ? 'var(--accent)' : pct >= 80 ? 'var(--accent2)' : 'var(--success)';
    const priceTag = event.price > 0 ? `KES ${event.price.toLocaleString()}` : 'Free';
    const imgSeed = event.image || event.title.replace(/\s/g, '');
    const whatsappText = encodeURIComponent(`ðŸŽ‰ Check out "${event.title}" at ${event.venue} on ${this.formatDate(event.date)}! Book now on UniVibe.`);

    const typeBadge = event.type === 'school'
      ? `<span class="badge badge-school"><i class="fas fa-building-columns"></i> ${this.esc(event.school || 'School Event')}</span>`
      : `<span class="badge badge-normal"><i class="fas fa-globe"></i> Open Event</span>`;

    document.getElementById('eventDetailContent').innerHTML = `
      <div class="flex flex-col md:flex-row max-h-[90vh] overflow-y-auto">
        <!-- Left Column -->
        <div class="md:w-3/5 p-8 bg-white">
          <div class="mb-6 relative rounded-2xl overflow-hidden">
            <img src="${event.image && event.image.startsWith('http') ? event.image : `https://picsum.photos/seed/${encodeURIComponent(imgSeed)}/800/600.jpg`}" alt="${this.esc(event.title)}" class="w-full h-[400px] object-cover" onerror="this.style.display='none'">
          </div>
          <h2 class="font-extrabold text-3xl mb-4 text-black">${this.esc(event.title)}</h2>
          <div class="flex items-center gap-2 mb-6">
            <i class="fas fa-location-dot text-[var(--accent)]"></i>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.mapQuery || event.venue)}" target="_blank" class="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors underline decoration-dashed underline-offset-4">${this.esc(event.venue)} <i class="fas fa-external-link-alt text-xs ml-1"></i></a>
          </div>
          <div class="flex items-center gap-2 mb-8">
            <i class="fas fa-calendar-day text-[var(--accent)]"></i>
            <span class="text-sm text-[var(--muted)]">${this.formatDate(event.date)} &bull; ${this.formatTime(event.time)}</span>
          </div>
          
          <h3 class="font-bold text-xl mb-3 text-black border-b border-[var(--border)] pb-2">Description</h3>
          <p class="text-[var(--muted)] text-sm mb-6 leading-relaxed whitespace-pre-wrap">${this.esc(event.description)}</p>

          <h3 class="font-bold text-xl mb-3 text-black border-b border-[var(--border)] pb-2">Tags</h3>
          <div class="flex flex-wrap gap-2 mb-4">
            ${typeBadge}
          </div>
        </div>

        <!-- Right Column / Sticky Widget -->
        <div class="md:w-2/5 p-8 bg-[#F8F9FA] border-l border-[var(--border)] flex flex-col">
          <button onclick="App.closeModal('eventDetailModal')" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center hover:bg-gray-100 transition-colors z-10">
            <i class="fas fa-xmark text-black"></i>
          </button>
          
          <div class="sticky top-0 pt-4">
            <h3 class="font-bold text-2xl mb-2 text-black">Get tickets</h3>
            <p class="text-sm text-[var(--muted)] mb-8">You're booking for ${this.esc(event.title)}</p>
            
            <div class="bg-white border border-[var(--border)] p-4 rounded-2xl shadow-sm mb-6 space-y-3">
              ${(event.tiers || []).map((t, idx) => {
                const isTierFull = t.bookedSlots >= t.totalSlots;
                const tierSlotsLeft = Math.max(0, t.totalSlots - t.bookedSlots);
                return `
                <label class="flex justify-between items-center p-3 border border-[var(--border)] rounded-lg ${isTierFull ? 'bg-gray-50 hover:border-[var(--accent)] cursor-pointer' : 'cursor-pointer hover:border-black'} transition-colors">
                  <div class="flex items-center gap-3">
                    <input type="radio" name="selectedTier" value="${t.id}" class="w-4 h-4 text-black" ${idx === 0 ? 'checked' : ''}>
                    <div>
                      <div class="font-bold text-sm text-black">${this.esc(t.name)} ${isTierFull ? '<span class="ml-2 text-xs text-[var(--accent)]">(Waitlist)</span>' : ''}</div>
                      <div class="text-xs ${isTierFull ? 'text-[var(--accent)]' : 'text-[var(--success)]'} font-semibold">${isTierFull ? '0 slots left' : tierSlotsLeft + ' slots left'}</div>
                    </div>
                  </div>
                  <div class="text-sm font-extrabold text-[var(--accent)]">${t.price > 0 ? 'KES ' + t.price.toLocaleString() : 'Free'}</div>
                </label>
                `;
              }).join('')}
            </div>

            <div class="flex gap-3 mt-auto">
              ${isEnded ? '<button class="btn-secondary w-full justify-center py-4 text-lg" disabled>Event Ended</button>' :
                `<button class="btn-primary w-full justify-center py-4 text-lg bg-[var(--accent)] text-white hover:bg-[#A00000]" onclick="App.handleBookNowClick('${event.id}')">Continue</button>`}
            </div>
            
            <div class="mt-5 flex flex-col items-center gap-3">
              <div class="w-full flex justify-center">
                ${this.calendarDropdownHTML(event.id, 'up')}
              </div>
              <a href="https://wa.me/?text=${whatsappText}" target="_blank" class="text-[var(--success)] hover:underline flex items-center gap-2 text-sm font-semibold">
                <i class="fab fa-whatsapp text-lg"></i> Share with friends
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    this.openModal('eventDetailModal');
  },

  handleBookNowClick(eventId) {
    const selected = document.querySelector('input[name="selectedTier"]:checked');
    if (!selected) {
      this.toast('Please select a ticket tier', 'error');
      return;
    }
    
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    const tier = event.tiers.find(t => t.id === selected.value);
    if (!tier) return;

    this.closeModal('eventDetailModal');
    
    if (tier.bookedSlots >= tier.totalSlots) {
      this.openWaitlistModal(eventId, tier.id);
    } else {
      this.openBooking(eventId, tier.id);
    }
  },

  openWaitlistModal(eventId, tierId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    const tier = event.tiers.find(t => t.id === tierId);
    if (!tier) return;

    document.getElementById('waitlistEventId').value = eventId;
    document.getElementById('waitlistTierId').value = tierId;
    document.getElementById('wlFullName').value = '';
    document.getElementById('wlPhone').value = '';
    document.getElementById('wlRegNumber').value = '';
    document.getElementById('wlSchool').value = '';

    const priceTag = tier.price > 0 ? `KES ${tier.price.toLocaleString()}` : 'Free';
    document.getElementById('waitlistEventSummary').innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h4 class="font-bold mb-1">${this.esc(event.title)}</h4>
          <div class="text-sm font-semibold text-[var(--accent)] mb-1">${this.esc(tier.name)} Tier (Waitlist)</div>
          <div class="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span><i class="fas fa-calendar"></i> ${this.formatDate(event.date)}</span>
            <span><i class="fas fa-clock"></i> ${this.formatTime(event.time)}</span>
          </div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-bold text-gradient">${priceTag}</div>
          <div class="text-xs text-[var(--accent)]">Full</div>
        </div>
      </div>
    `;

    if (event.type === 'school') {
      document.getElementById('wlRegNumberField').style.display = 'block';
      document.getElementById('wlSchoolField').style.display = 'block';
      document.getElementById('wlRegNumber').required = true;
      document.getElementById('wlSchool').required = true;
    } else {
      document.getElementById('wlRegNumberField').style.display = 'none';
      document.getElementById('wlSchoolField').style.display = 'none';
      document.getElementById('wlRegNumber').required = false;
      document.getElementById('wlSchool').required = false;
      document.getElementById('wlRegNumber').value = '';
      document.getElementById('wlSchool').value = '';
    }

    document.querySelectorAll('#waitlistForm .form-input.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('#waitlistForm [id^="wlErr"]').forEach(el => el.classList.add('hidden'));

    this.openModal('waitlistModal');
  },

  closeWaitlistModal() {
    this.closeModal('waitlistModal');
  },

  submitWaitlist(e) {
    e.preventDefault();
    document.querySelectorAll('#waitlistForm .form-input.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('#waitlistForm [id^="wlErr"]').forEach(el => el.classList.add('hidden'));

    const eventId = document.getElementById('waitlistEventId').value;
    const tierId = document.getElementById('waitlistTierId').value;
    const event = this.events.find(ev => ev.id === eventId);
    if (!event) return;

    const fullName = document.getElementById('wlFullName').value.trim();
    const regNumber = document.getElementById('wlRegNumber').value.trim();
    const school = document.getElementById('wlSchool').value;
    const phone = document.getElementById('wlPhone').value.trim();

    let valid = true;

    if (!fullName || fullName.length < 3) {
      document.getElementById('wlFullName').classList.add('error');
      document.getElementById('wlErrFullName').classList.remove('hidden');
      valid = false;
    }
    if (event.type === 'school' && !regNumber) {
      document.getElementById('wlRegNumber').classList.add('error');
      document.getElementById('wlErrRegNumber').classList.remove('hidden');
      valid = false;
    }
    if (event.type === 'school' && !school) {
      document.getElementById('wlSchool').classList.add('error');
      document.getElementById('wlErrSchool').classList.remove('hidden');
      valid = false;
    }

    const phoneClean = phone.replace(/\s/g, '');
    const kenyanPhoneRegex = /^(\+254|254|0)?(1|7)\d{8}$/;
    if (!kenyanPhoneRegex.test(phoneClean)) {
      document.getElementById('wlPhone').classList.add('error');
      document.getElementById('wlErrPhone').classList.remove('hidden');
      valid = false;
    }

    if (!valid) return;

    let normalizedPhone = phoneClean;
    if (normalizedPhone.startsWith('+254')) normalizedPhone = '0' + normalizedPhone.slice(4);
    else if (normalizedPhone.startsWith('254')) normalizedPhone = '0' + normalizedPhone.slice(3);
    else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone;

    if (this.waitlists.some(w => w.eventId === eventId && w.tierId === tierId && w.phone === normalizedPhone)) {
      this.toast('You are already on the waitlist for this tier.', 'info');
      return;
    }

    const wlBtn = document.getElementById('wlSubmitBtn');
    const ogHtml = wlBtn.innerHTML;
    wlBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';
    wlBtn.disabled = true;

    db.collection('waitlists').add({
      eventId,
      tierId,
      fullName,
      phone: normalizedPhone,
      regNumber: event.type === 'school' ? regNumber : '',
      school: event.type === 'school' ? school : '',
      joinedAt: new Date().toISOString()
    }).then(() => {
      this.closeWaitlistModal();
      this.toast("You're on the waitlist — we'll let you know if a spot opens up", 'success');
    }).catch(err => {
      console.error('Error joining waitlist:', err);
      this.toast('Failed to join waitlist', 'error');
    }).finally(() => {
      wlBtn.innerHTML = ogHtml;
      wlBtn.disabled = false;
    });
  },

  // ===================== BOOKING MODAL =====================
  openBooking(eventId, tierId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    
    const tier = event.tiers.find(t => t.id === tierId);
    if (!tier) return;

    const isFull = tier.bookedSlots >= tier.totalSlots;
    const isEnded = new Date(event.date + 'T23:59:59') < new Date();
    if (isFull || isEnded) {
      this.toast(isFull ? 'All slots are already booked for this tier' : 'This event has already ended', 'error');
      return;
    }

    document.getElementById('bookingEventId').value = eventId;
    // We'll store the tierId in a data attribute or hidden input. Let's add a hidden input.
    let tierInput = document.getElementById('bookingTierId');
    if (!tierInput) {
      tierInput = document.createElement('input');
      tierInput.type = 'hidden';
      tierInput.id = 'bookingTierId';
      document.getElementById('bookingForm').appendChild(tierInput);
    }
    tierInput.value = tierId;
    // Reset user data
    document.getElementById('bookFullName').value = '';
    document.getElementById('bookPhone').value = '';
    document.getElementById('bookRegNumber').value = '';
    document.getElementById('bookSchool').value = '';

    // Render event summary
    const slotsLeft = tier.totalSlots - tier.bookedSlots;
    const priceTag = tier.price > 0 ? `KES ${tier.price.toLocaleString()}` : 'Free';
    document.getElementById('bookingEventSummary').innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h4 class="font-bold mb-1">${this.esc(event.title)}</h4>
          <div class="text-sm font-semibold text-[var(--accent)] mb-1">${this.esc(tier.name)} Tier</div>
          <div class="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span><i class="fas fa-calendar"></i> ${this.formatDate(event.date)}</span>
            <span><i class="fas fa-clock"></i> ${this.formatTime(event.time)}</span>
          </div>
          <div class="text-xs text-[var(--muted)] mt-1"><i class="fas fa-location-dot"></i> ${this.esc(event.venue)}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-sm font-bold text-gradient">${priceTag}</div>
          <div class="text-xs text-[var(--muted)]">${slotsLeft} slots left</div>
        </div>
      </div>
    `;

    // Show/hide school-specific fields
    if (event.type === 'school') {
      document.getElementById('regNumberField').style.display = 'block';
      document.getElementById('schoolField').style.display = 'block';
      document.getElementById('bookRegNumber').required = true;
      document.getElementById('bookSchool').required = true;
    } else {
      document.getElementById('regNumberField').style.display = 'none';
      document.getElementById('schoolField').style.display = 'none';
      document.getElementById('bookRegNumber').required = false;
      document.getElementById('bookSchool').required = false;
      document.getElementById('bookRegNumber').value = '';
      document.getElementById('bookSchool').value = '';
    }

    this.clearBookingFormErrors();

    this.openModal('bookingModal');
  },

  closeBookingModal() {
    this.closeModal('bookingModal');
  },

  clearBookingFormErrors() {
    document.querySelectorAll('#bookingForm .form-input.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('#bookingForm [id^="bookErr"]').forEach(el => el.classList.add('hidden'));
  },

  // ===================== VALIDATE & SUBMIT BOOKING =====================
  submitBooking(e) {
    e.preventDefault();
    this.clearBookingFormErrors();

    const eventId = document.getElementById('bookingEventId').value;
    const event = this.events.find(ev => ev.id === eventId);
    if (!event) return;

    // Check slots again
    if (event.bookedSlots >= event.totalSlots) {
      this.toast("Looks like all slots just got taken — try joining the waitlist", 'error');
      this.closeBookingModal();
      return;
    }

    const fullName = document.getElementById('bookFullName').value.trim();
    const regNumber = document.getElementById('bookRegNumber').value.trim();
    const school = document.getElementById('bookSchool').value;
    const phone = document.getElementById('bookPhone').value.trim();

    let valid = true;

    // Validate full name
    if (!fullName || fullName.length < 3) {
      document.getElementById('bookFullName').classList.add('error');
      document.getElementById('bookErrFullName').classList.remove('hidden');
      valid = false;
    }

    // Validate reg number for school events
    if (event.type === 'school' && !regNumber) {
      document.getElementById('bookRegNumber').classList.add('error');
      document.getElementById('bookErrRegNumber').classList.remove('hidden');
      valid = false;
    }

    // Validate school for school events
    if (event.type === 'school' && !school) {
      document.getElementById('bookSchool').classList.add('error');
      document.getElementById('bookErrSchool').classList.remove('hidden');
      valid = false;
    }

    // Validate Kenyan phone number
    // The input has a visual +254 prefix, so user types the rest (e.g. 712345678)
    // We also accept full formats: 0712345678, +254712345678, 254712345678
    const phoneClean = phone.replace(/\s/g, '');
    const kenyanPhoneRegex = /^(\+254|254|0)?(1|7)\d{8}$/;
    if (!kenyanPhoneRegex.test(phoneClean)) {
      document.getElementById('bookPhone').classList.add('error');
      document.getElementById('bookErrPhone').classList.remove('hidden');
      valid = false;
    }

    if (!valid) return;

    // Normalize phone to 07XX format
    let normalizedPhone = phoneClean;
    if (normalizedPhone.startsWith('+254')) normalizedPhone = '0' + normalizedPhone.slice(4);
    else if (normalizedPhone.startsWith('254')) normalizedPhone = '0' + normalizedPhone.slice(3);
    else if (!normalizedPhone.startsWith('0')) normalizedPhone = '0' + normalizedPhone;

    const quantity = parseInt(document.getElementById('bookQuantity').value) || 1;

    // Check limits
    if (!event.allowMultiple) {
      const alreadyBooked = this.bookings.some(b => b.phone === normalizedPhone && b.eventId === eventId);
      if (alreadyBooked) {
        this.toast('You have already booked a ticket for this event', 'error');
        return;
      }
    } else {
      const currentBookedCount = this.bookings.filter(b => b.phone === normalizedPhone && b.eventId === eventId).length;
      if (currentBookedCount + quantity > event.maxTickets) {
        this.toast(`You can only book up to ${event.maxTickets} tickets. You already have ${currentBookedCount}.`, 'error');
        return;
      }
    }

    const tierId = document.getElementById('bookingTierId').value;
    const tier = event.tiers.find(t => t.id === tierId);

    // Store pending booking data for confirmation step
    this.pendingBooking = {
      eventId,
      tierId,
      fullName,
      phone: normalizedPhone,
      regNumber: event.type === 'school' ? regNumber : '',
      school: event.type === 'school' ? school : '',
      quantity
    };

    // Show confirmation modal
    const priceTag = tier.price > 0 ? `KES ${(tier.price * quantity).toLocaleString()}` : 'Free';
    document.getElementById('confirmBookingDetails').innerHTML = `
      <div class="space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-[var(--muted)]">Event</span><span class="font-semibold text-right max-w-[200px]">${this.esc(event.title)}</span></div>
        <div class="flex justify-between"><span class="text-[var(--muted)]">Tier</span><span class="font-semibold text-[var(--accent)]">${this.esc(tier.name)}</span></div>
        <div class="flex justify-between"><span class="text-[var(--muted)]">Tickets</span><span class="font-semibold">${quantity}</span></div>
        <div class="flex justify-between"><span class="text-[var(--muted)]">Name</span><span class="font-semibold">${this.esc(fullName)}</span></div>
        ${event.type === 'school' ? `<div class="flex justify-between"><span class="text-[var(--muted)]">Reg No.</span><span class="font-semibold">${this.esc(regNumber)}</span></div>` : ''}
        ${event.type === 'school' ? `<div class="flex justify-between"><span class="text-[var(--muted)]">School</span><span class="font-semibold">${this.esc(school)}</span></div>` : ''}
        <div class="flex justify-between"><span class="text-[var(--muted)]">Phone</span><span class="font-semibold">${this.esc(normalizedPhone)}</span></div>
        <div class="flex justify-between"><span class="text-[var(--muted)]">Date</span><span class="font-semibold">${this.formatDate(event.date)}</span></div>
        <div class="flex justify-between"><span class="text-[var(--muted)]">Venue</span><span class="font-semibold">${this.esc(event.venue)}</span></div>
        <div class="flex justify-between border-t border-[var(--border)] pt-2 mt-2"><span class="text-[var(--muted)] font-bold">Total Price</span><span class="font-bold text-gradient">${priceTag}</span></div>
      </div>
    `;

    this.closeBookingModal();
    this.openModal('confirmBookingModal');
  },

  closeConfirmBooking() {
    this.closeModal('confirmBookingModal');
    this.pendingBooking = null;
  },

  finalizeBooking() {
    if (!this.pendingBooking) return;

    const { eventId, tierId, fullName, phone, regNumber, school, quantity } = this.pendingBooking;
    const event = this.events.find(ev => ev.id === eventId);
    if (!event) return;

    const tier = event.tiers.find(t => t.id === tierId);
    if (!tier) return;

    // Final slot check
    if (tier.bookedSlots + quantity > tier.totalSlots) {
      this.toast(`Sorry, only ${tier.totalSlots - tier.bookedSlots} slots left for this tier!`, 'error');
      this.closeConfirmBooking();
      return;
    }

    // Create bookings via Firestore batch
    const batch = db.batch();
    const newBookings = [];
    for (let i = 0; i < quantity; i++) {
      const ticketCode = this.genTicketCode();
      const booking = {
        id: this.uid(),
        eventId: eventId,
        tierId: tierId,
        fullName: fullName,
        phone: phone,
        regNumber: regNumber,
        school: school,
        bookedAt: new Date().toISOString(),
        ticketCode: ticketCode
      };
      const bookingRef = db.collection('bookings').doc(booking.id);
      batch.set(bookingRef, booking);
      newBookings.push(booking);
    }
    
    tier.bookedSlots += quantity;
    const eventRef = db.collection('events').doc(eventId);
    batch.update(eventRef, { tiers: event.tiers });

    batch.commit().then(() => {
      this.pendingBooking = null;
      this.closeModal('confirmBookingModal');
      
      if (quantity > 1) {
        this.toast(`Successfully booked ${quantity} tickets! They are saved in My Bookings.`, 'success');
      } else {
        this.toast('Booking confirmed successfully!', 'success');
      }
      
      this.showTicket(newBookings[0], event, tier);
      this.renderEvents();
      this.updateHeroStats();
    }).catch(err => {
      console.error('Error booking:', err);
      this.toast('Error processing booking. Please try again.', 'error');
      // Revert optimistic slot increase locally if failed
      tier.bookedSlots -= quantity; 
    });
  },

  // ===================== TICKET DISPLAY =====================
  showTicket(booking, event, tier = null) {
    if (!tier) {
      tier = event.tiers.find(t => t.id === booking.tierId) || event.tiers[0];
    }
    this.lastTicketData = { booking, event, tier };
    const dateFormatted = this.formatDate(event.date);
    const timeFormatted = this.formatTime(event.time);
    const priceTag = tier.price > 0 ? `KES ${tier.price.toLocaleString()}` : 'Free';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(booking.ticketCode)}`;

    document.getElementById('ticketContent').innerHTML = `
      <div class="text-center mb-4">
        <div class="text-xs text-[var(--muted)] mb-1 font-bold uppercase tracking-widest">Ticket Code</div>
        <div class="text-3xl font-black tracking-widest text-[var(--accent)] mb-4">${this.esc(booking.ticketCode)}</div>
        <img src="${qrUrl}" alt="QR Code" class="mx-auto rounded-xl border border-[var(--border)] p-2 bg-white" width="150" height="150">
      </div>
      <div class="ticket-tear border-t border-dashed border-[var(--border)] my-6"></div>
      
      <div class="grid grid-cols-2 gap-y-4 gap-x-4 text-sm px-2">
        <div class="text-[var(--muted)] font-medium">Event</div>
        <div class="font-bold text-right text-black uppercase">${this.esc(event.title)}</div>
        
        <div class="text-[var(--muted)] font-medium">Attendee Name</div>
        <div class="font-bold text-right text-black capitalize">${this.esc(booking.fullName)}</div>
        
        <div class="text-[var(--muted)] font-medium">Ticket Tier</div>
        <div class="font-bold text-right text-[var(--accent)]">${this.esc(tier.name)}</div>
        
        ${booking.regNumber ? `
        <div class="text-[var(--muted)] font-medium">Reg No.</div>
        <div class="font-bold text-right text-black">${this.esc(booking.regNumber)}</div>
        ` : ''}
        
        <div class="text-[var(--muted)] font-medium">Phone Number</div>
        <div class="font-bold text-right text-black">${this.esc(booking.phone)}</div>
        
        <div class="text-[var(--muted)] font-medium">Date & Time</div>
        <div class="font-bold text-right text-black">${dateFormatted} &bull; ${timeFormatted}</div>
        
        <div class="text-[var(--muted)] font-medium">Venue</div>
        <div class="font-bold text-right text-black capitalize">${this.esc(event.venue)}</div>
        
        <div class="col-span-2 mt-2 pt-4 border-t border-[var(--border)] flex justify-between items-center">
          <span class="text-[var(--muted)] font-medium">Total Amount</span>
          <span class="font-black text-lg text-[var(--accent)]">${priceTag}</span>
        </div>
      </div>
    `;

    this.openModal('ticketModal');
    // Inject Add to Calendar button after modal is rendered
    setTimeout(() => this.injectTicketCalendarBtn(event.id), 50);
  },

  closeTicketModal() {
    this.closeModal('ticketModal');
  },

  downloadTicket() {
    if (!this.lastTicketData) return;
    const { booking } = this.lastTicketData;
    const ticketElement = document.getElementById('ticketContent');
    
    if (!ticketElement) {
      this.toast('Could not find ticket to download', 'error');
      return;
    }
    
    const btn = document.querySelector('button[onclick="App.downloadTicket()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    html2canvas(ticketElement, { 
      useCORS: true, 
      backgroundColor: null,
      scale: 2
    }).then(canvas => {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `UniVibe-Ticket-${booking.ticketCode}.png`;
      a.click();
      this.toast('Ticket downloaded successfully as an image!', 'success');
    }).catch(err => {
      console.error('Error generating ticket image:', err);
      this.toast('Failed to save ticket as image', 'error');
    }).finally(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    });
  },

  shareOnWhatsApp() {
    if (!this.lastTicketData) return;
    const { booking, event } = this.lastTicketData;
    const text = `ðŸŽ‰ I just booked a ticket for *${event.title}*!\nðŸ“… ${this.formatDate(event.date)} at ${this.formatTime(event.time)}\nðŸ“  ${event.venue}\nðŸŽ« Ticket: ${booking.ticketCode}\n\nBook yours on UniVibe!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  },

  // ===================== ADD TO CALENDAR =====================
  buildCalendarData(event) {
    const title = event.title || 'Untitled Event';
    const description = (event.description || '').replace(/\n/g, ' ');
    const location = event.venue || '';

    // Build datetime strings (ICS format: YYYYMMDDTHHMMSS)
    const datePart = (event.date || '2026-01-01').replace(/-/g, '');
    const timePart = (event.time || '09:00').replace(':', '') + '00';
    const startDT = datePart + 'T' + timePart;

    // End = start + 2 hours
    const startMs = new Date(`${event.date}T${event.time || '09:00'}:00`).getTime();
    const endDate = new Date(startMs + 2 * 60 * 60 * 1000);
    const endDT = endDate.toISOString().replace(/[-:]/g, '').split('.')[0];

    // Google Calendar URL
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${startDT}/${endDT}` +
      `&details=${encodeURIComponent(description)}` +
      `&location=${encodeURIComponent(location)}`;

    // Outlook Online URL
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}` +
      `&startdt=${event.date}T${event.time || '09:00'}:00` +
      `&enddt=${endDate.toISOString().slice(0, 19)}` +
      `&body=${encodeURIComponent(description)}` +
      `&location=${encodeURIComponent(location)}`;

    // ICS content (Apple Calendar / Outlook desktop / any calendar app)
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//UniVibe//EN',
      'BEGIN:VEVENT',
      `DTSTART:${startDT}`,
      `DTEND:${endDT}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return { googleUrl, outlookUrl, icsContent, title };
  },

  downloadICS(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    const { icsContent, title } = this.buildCalendarData(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('Calendar file downloaded — open it to add to Apple / Outlook!', 'success');
  },

  addToGoogleCalendar(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    const { googleUrl } = this.buildCalendarData(event);
    window.open(googleUrl, '_blank');
    this.toast('Opening Google Calendar...', 'info');
  },

  addToOutlook(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    const { outlookUrl } = this.buildCalendarData(event);
    window.open(outlookUrl, '_blank');
    this.toast('Opening Outlook Calendar...', 'info');
  },

  calendarDropdownHTML(eventId, placement = 'down') {
    return `
      <div class="atc-wrapper">
        <button onclick="App.toggleCalendarDrop('${eventId}')" id="atcBtn-${eventId}" class="atc-btn">
          <i class="far fa-calendar-plus"></i>
          <span>Add to Calendar</span>
          <i class="fas fa-chevron-down atc-chevron"></i>
        </button>
        <div class="atc-drop ${placement === 'up' ? 'atc-drop-up' : ''}" id="atcDrop-${eventId}">
          <button class="atc-option" onclick="App.addToGoogleCalendar('${eventId}'); App.closeCalendarDrop('${eventId}')">
            <span class="atc-icon atc-google"><i class="fab fa-google"></i></span>
            Google Calendar
          </button>
          <button class="atc-option" onclick="App.downloadICS('${eventId}'); App.closeCalendarDrop('${eventId}')">
            <span class="atc-icon atc-apple"><i class="fab fa-apple"></i></span>
            Apple Calendar
          </button>
          <button class="atc-option" onclick="App.addToOutlook('${eventId}'); App.closeCalendarDrop('${eventId}')">
            <span class="atc-icon atc-outlook"><i class="fas fa-envelope"></i></span>
            Outlook Calendar
          </button>
        </div>
      </div>
    `;
  },

  toggleCalendarDrop(eventId) {
    const drop = document.getElementById(`atcDrop-${eventId}`);
    const btn = document.getElementById(`atcBtn-${eventId}`);
    if (!drop) return;
    // Close all other open dropdowns
    document.querySelectorAll('.atc-drop.open').forEach(d => {
      if (d !== drop) {
        d.classList.remove('open');
        const chevron = d.previousElementSibling?.querySelector('.atc-chevron');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    });
    const isOpen = drop.classList.toggle('open');
    const chevron = btn?.querySelector('.atc-chevron');
    if (chevron) chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  },

  closeCalendarDrop(eventId) {
    const drop = document.getElementById(`atcDrop-${eventId}`);
    const btn = document.getElementById(`atcBtn-${eventId}`);
    if (drop) drop.classList.remove('open');
    const chevron = btn?.querySelector('.atc-chevron');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  },

  injectTicketCalendarBtn(eventId) {
    const container = document.getElementById('ticketCalendarContainer');
    if (container) container.innerHTML = this.calendarDropdownHTML(eventId, 'up');
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.atc-wrapper')) {
        document.querySelectorAll('.atc-drop.open').forEach(d => d.classList.remove('open'));
      }
    });
  },


  cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this ticket? This action cannot be undone.')) return;

    const booking = this.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const eventId = booking.eventId;
    const tierId = booking.tierId;
    const event = this.events.find(e => e.id === eventId);

    const batch = db.batch();
    const bookingRef = db.collection('bookings').doc(bookingId);
    batch.delete(bookingRef);

    // Look for a waitlisted user
    const waitlistedUsers = this.waitlists.filter(w => w.eventId === eventId && w.tierId === tierId);
    waitlistedUsers.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    const nextUser = waitlistedUsers.length > 0 ? waitlistedUsers[0] : null;

    if (nextUser) {
      // Allocate to waitlisted user
      const newTicketCode = this.genTicketCode();
      const newBooking = {
        id: this.uid(),
        eventId: eventId,
        tierId: tierId,
        fullName: nextUser.fullName,
        phone: nextUser.phone,
        regNumber: nextUser.regNumber || '',
        school: nextUser.school || '',
        bookedAt: new Date().toISOString(),
        ticketCode: newTicketCode
      };
      const newBookingRef = db.collection('bookings').doc(newBooking.id);
      batch.set(newBookingRef, newBooking);

      const waitlistRef = db.collection('waitlists').doc(nextUser.id);
      batch.delete(waitlistRef);

      batch.commit().then(() => {
        this.toast('Ticket canceled and automatically allocated to the next person on the waitlist!', 'success');
        this.lookupBookings();
      }).catch(err => {
        console.error('Error in reallocation:', err);
        this.toast('Error processing cancellation', 'error');
      });
    } else {
      // No waitlisted user, just free up the slot
      if (event) {
        const tier = event.tiers.find(t => t.id === tierId);
        if (tier) {
          tier.bookedSlots = Math.max(0, tier.bookedSlots - 1);
          const eventRef = db.collection('events').doc(eventId);
          batch.update(eventRef, { tiers: event.tiers });
        }
      }
      batch.commit().then(() => {
        this.toast('Ticket canceled successfully.', 'success');
        this.lookupBookings();
      }).catch(err => {
        console.error('Error cancelling:', err);
        this.toast('Error cancelling ticket', 'error');
      });
    }
  },

  toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.documentElement.classList.contains('dark') ? 'fa-sun' : 'fa-moon';
    const deskBtn = document.getElementById('themeToggleBtnDesk');
    if (deskBtn) deskBtn.innerHTML = `<i class="fas ${icon}"></i>`;
  },

  // ===================== ADMIN LOGIN =====================
  adminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const pwd = document.getElementById('adminPassword').value;
    const auth = window.firebase && firebase.auth ? firebase.auth() : null;
    
    if (!auth) {
      this.toast('Authentication module not loaded', 'error');
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pwd)
      .then(() => {
        document.getElementById('adminEmail').value = '';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminErrPwd').classList.add('hidden');
        window.location.href = 'admin.html';
      })
      .catch((err) => {
        document.getElementById('adminErrPwd').textContent = err.message;
        document.getElementById('adminErrPwd').classList.remove('hidden');
        btn.innerHTML = ogHtml;
        btn.disabled = false;
      });
  },

  adminLogout() {
    const auth = window.firebase && firebase.auth ? firebase.auth() : null;
    if (auth) {
      auth.signOut().then(() => {
        window.location.href = 'index.html';
      });
    } else {
      window.location.href = 'index.html';
    }
  },

  togglePasswordVisibility() {
    const input = document.getElementById('adminPassword');
    const icon = document.getElementById('pwdToggleIcon');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  },

  // ===================== SOCIAL MEDIA =====================
  saveSocials(e) {
    e.preventDefault();
    
    const formatUrl = (url) => {
      if (!url) return '';
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
      }
      return url;
    };

    this.socials.facebook = formatUrl(document.getElementById('socialFacebook').value.trim());
    this.socials.instagram = formatUrl(document.getElementById('socialInstagram').value.trim());
    this.socials.twitter = formatUrl(document.getElementById('socialTwitter').value.trim());
    
    localStorage.setItem('uv_socials', JSON.stringify(this.socials));
    this.renderSocials(); // update if we were on the same page
    this.toast('Social handles updated successfully!', 'success');
  },

  saveCloudinarySettings(e) {
    e.preventDefault();
    this.cloudinary.name = document.getElementById('cloudinaryName').value.trim();
    this.cloudinary.preset = document.getElementById('cloudinaryPreset').value.trim();
    localStorage.setItem('uv_cloudinary', JSON.stringify(this.cloudinary));
    this.toast('Cloudinary settings saved!', 'success');
  },

  saveUnsplashSettings(e) {
    e.preventDefault();
    this.unsplashAccessKey = document.getElementById('unsplashAccessKey').value.trim();
    localStorage.setItem('uv_unsplash', this.unsplashAccessKey);
    this.toast('Unsplash settings saved!', 'success');
  },

  saveGeminiSettings(e) {
    e.preventDefault();
    this.geminiApiKey = document.getElementById('geminiApiKey').value.trim();
    localStorage.setItem('uv_gemini', this.geminiApiKey);
    this.toast('Gemini API settings saved!', 'success');
  },

  async generateAiDescription() {
    if (!this.geminiApiKey) {
      this.toast('Please configure Gemini API Key in Settings first!', 'error');
      return;
    }
    
    const title = document.getElementById('eventTitle').value.trim();
    if (!title) {
      this.toast('Please enter an Event Title first!', 'warning');
      return;
    }

    const type = document.getElementById('eventType').value;
    const school = document.getElementById('eventSchool').value;
    
    let promptContext = `an event titled "${title}"`;
    if (type === 'school' && school) {
      promptContext += ` for students at the ${school}`;
    }

    const promptText = `Write a short, exciting, and professional event description for ${promptContext}. It should be 2-3 short paragraphs. Make it engaging and encourage people to attend. Do not include placeholders for date/time/venue as those are shown elsewhere. Keep it under 150 words.`;

    const btn = document.getElementById('btnGenerateDesc');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-blue-500"></i> Generating...';
    btn.disabled = true;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });
      
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      const generatedText = data.candidates[0].content.parts[0].text;
      document.getElementById('eventDesc').value = generatedText.trim();
      this.toast('Description generated successfully!', 'success');
    } catch (err) {
      console.error(err);
      this.toast('AI Error: ' + err.message, 'error');
    } finally {
      btn.innerHTML = ogHtml;
      btn.disabled = false;
    }
  },

  async searchUnsplash() {
    if (!this.unsplashAccessKey) {
      this.toast('Please configure Unsplash Access Key in Settings first!', 'error');
      return;
    }
    const query = document.getElementById('unsplashSearchQuery').value.trim();
    const resultsContainer = document.getElementById('unsplashResults');
    
    if (!query) return;

    resultsContainer.innerHTML = '<div class="col-span-full text-center py-4"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    
    try {
      const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=9`, {
        headers: {
          'Authorization': `Client-ID ${this.unsplashAccessKey}`
        }
      });
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        let html = '';
        data.results.forEach(photo => {
          const thumb = photo.urls.small;
          const full = photo.urls.regular;
          html += `<div class="relative cursor-pointer group rounded-lg overflow-hidden border-2 border-transparent hover:border-[var(--accent)] transition-all" onclick="App.selectUnsplashImage('${full}', this)">
                     <img src="${thumb}" class="w-full h-24 object-cover" />
                     <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <i class="fas fa-check text-white text-xl"></i>
                     </div>
                   </div>`;
        });
        resultsContainer.innerHTML = html;
      } else {
        resultsContainer.innerHTML = '<div class="col-span-full text-center py-4 text-[var(--muted)]">No photos found</div>';
      }
    } catch (err) {
      resultsContainer.innerHTML = '<div class="col-span-full text-center py-4 text-[var(--accent)]">Error searching Unsplash</div>';
    }
  },

  selectUnsplashImage(url, element) {
    document.getElementById('unsplashSelectedUrl').value = url;
    // Highlight selection
    document.querySelectorAll('#unsplashResults > div').forEach(div => {
      div.classList.remove('border-[var(--accent)]', 'ring-2', 'ring-[var(--accent)]');
    });
    element.classList.add('border-[var(--accent)]', 'ring-2', 'ring-[var(--accent)]');
    this.toast('Image selected!', 'success');
  },

  async uploadImageToCloudinary(file) {
    if (!this.cloudinary.name || !this.cloudinary.preset) {
      throw new Error("Cloudinary settings not configured");
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.cloudinary.preset);
    
    const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudinary.name}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Upload failed");
    }
    
    const data = await res.json();
    return data.secure_url;
  },

  renderSocials() {
    const container = document.getElementById('footerSocials');
    if (!container) return;
    
    let html = '';
    if (this.socials.facebook) {
      html += `<a href="${this.esc(this.socials.facebook)}" target="_blank" class="w-12 h-12 rounded-full border border-[var(--border)] bg-white shadow-sm flex items-center justify-center text-[#1877F2] hover:border-[#1877F2] hover:shadow-lg hover:shadow-[#1877F2]/20 hover:-translate-y-1 transition-all duration-300 text-xl group">
                 <i class="fab fa-facebook-f group-hover:scale-110 transition-transform"></i>
               </a>`;
    }
    if (this.socials.instagram) {
      html += `<a href="${this.esc(this.socials.instagram)}" target="_blank" class="w-12 h-12 rounded-full border border-[var(--border)] bg-white shadow-sm flex items-center justify-center hover:border-[#E4405F] hover:shadow-lg hover:shadow-[#E4405F]/20 hover:-translate-y-1 transition-all duration-300 text-xl group">
                 <i class="fab fa-instagram text-transparent bg-clip-text bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] group-hover:scale-110 transition-transform"></i>
               </a>`;
    }
    if (this.socials.twitter) {
      html += `<a href="${this.esc(this.socials.twitter)}" target="_blank" class="w-12 h-12 rounded-full border border-[var(--border)] bg-white shadow-sm flex items-center justify-center text-[#1DA1F2] hover:border-[#1DA1F2] hover:shadow-lg hover:shadow-[#1DA1F2]/20 hover:-translate-y-1 transition-all duration-300 text-xl group">
                 <i class="fab fa-twitter group-hover:scale-110 transition-transform"></i>
               </a>`;
    }
    container.innerHTML = html;
  },

  renderAdminSocials() {
    const fb = document.getElementById('socialFacebook');
    if (fb) {
      fb.value = this.socials.facebook || '';
      document.getElementById('socialInstagram').value = this.socials.instagram || '';
      document.getElementById('socialTwitter').value = this.socials.twitter || '';
    }
  },

  renderAdminCloudinary() {
    const nameEl = document.getElementById('cloudinaryName');
    const presetEl = document.getElementById('cloudinaryPreset');
    const unsplashEl = document.getElementById('unsplashAccessKey');
    const geminiEl = document.getElementById('geminiApiKey');
    if (nameEl) nameEl.value = this.cloudinary.name || '';
    if (presetEl) presetEl.value = this.cloudinary.preset || '';
    if (unsplashEl) unsplashEl.value = this.unsplashAccessKey || '';
    if (geminiEl) geminiEl.value = this.geminiApiKey || '';
  },

  // ===================== ADMIN DASHBOARD =====================
  renderAdminDashboard() {
    this.renderAdminStats();
    this.renderAdminEvents();
    this.renderRecentBookings();
    this.renderAdminBookings();
    this.updateBookingFilterDropdown();
    this.updateWaitlistFilterDropdown();
    this.renderAdminWaitlist();
    this.renderAdminSocials();
    this.renderAdminCloudinary();
    this.renderActivityLogs();
  },

  setAdminTab(tab) {
    // Hide all panels
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active-panel'));
    
    // Update sidebar links active state
    document.querySelectorAll('.sidebar-link').forEach(t => t.classList.remove('active'));
    const tabBtn = document.getElementById('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    
    // Show selected panel
    const panelId = 'admin' + tab.charAt(0).toUpperCase() + tab.slice(1);
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active-panel');

    // Update topbar title and breadcrumb
    const topbarTitles = {
      'overview': 'Overview',
      'events': 'Manage Events',
      'create': this._isEditing ? 'Edit Event' : 'Create Event',
      'bookings': 'All Bookings',
      'waitlist': 'Waitlist',
      'settings': 'Settings',
      'scanner': 'Ticket Scanner',
      'logs': 'Activity Log'
    };
    document.getElementById('topbarTitle').textContent = topbarTitles[tab] || 'Dashboard';
    document.getElementById('topbarBreadcrumb').textContent = `Dashboard / ${topbarTitles[tab] || 'Overview'}`;

    // Close sidebar on mobile after clicking
    if (window.innerWidth <= 1024) {
      document.getElementById('adminSidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
    }

    // Only reset form when explicitly switching to Create tab (not when editing)
    if (tab === 'create' && !this._isEditing) {
      this.resetEventForm();
    }
    this._isEditing = false;

    // Populate settings fields when switching to settings tab
    if (tab === 'settings') {
      this.renderAdminSocials();
      this.renderAdminCloudinary();
    }

    // Populate logs when switching to logs tab
    if (tab === 'logs') {
      this.renderActivityLogs();
    }

    // Populate waitlist when switching to waitlist tab
    if (tab === 'waitlist') {
      this.updateWaitlistFilterDropdown();
      this.renderAdminWaitlist();
    }

    // Stop scanner if leaving scanner tab
    if (tab !== 'scanner' && this.scannerInstance) {
      this.stopScanner();
    }
  },

  toggleAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  },

  // ===================== QR SCANNER LOGIC =====================
  startScanner() {
    document.getElementById('startScannerBtn').classList.add('hidden');
    document.getElementById('stopScannerBtn').classList.remove('hidden');
    document.getElementById('scannerResult').classList.add('hidden');
    document.getElementById('scannerResult').className = 'p-4 rounded-xl text-sm font-semibold hidden mb-4';

    this.scannerInstance = new Html5QrcodeScanner(
      "scannerReader",
      { fps: 10, qrbox: {width: 250, height: 250} },
      /* verbose= */ false
    );
    this.scannerInstance.render(this.onScanSuccess.bind(this), this.onScanFailure.bind(this));
  },

  stopScanner() {
    if (this.scannerInstance) {
      this.scannerInstance.clear().then(() => {
        this.scannerInstance = null;
        const startBtn = document.getElementById('startScannerBtn');
        const stopBtn = document.getElementById('stopScannerBtn');
        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
      }).catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    }
  },

  onScanSuccess(decodedText, decodedResult) {
    const ticketCode = decodedText.trim();
    
    // Prevent rapid double-scans of the exact same ticket within 3 seconds
    if (this.lastScannedCode === ticketCode) return;
    
    this.lastScannedCode = ticketCode;
    clearTimeout(this.scanTimeout);
    this.scanTimeout = setTimeout(() => { this.lastScannedCode = null; }, 3000);
    
    const resultEl = document.getElementById('scannerResult');
    // Reset classes and ensure it's visible
    resultEl.className = 'p-4 rounded-xl text-sm font-semibold mb-4';
    
    const booking = this.bookings.find(b => b.ticketCode === ticketCode);
    
    if (!booking) {
      resultEl.classList.add('bg-[rgba(255,77,109,0.1)]', 'text-[var(--accent)]', 'border', 'border-[rgba(255,77,109,0.3)]');
      resultEl.innerHTML = `<i class="fas fa-circle-xmark text-lg mb-1"></i><br>Invalid Ticket Code: ${this.esc(ticketCode)}`;
      return;
    }
    
    const event = this.events.find(e => e.id === booking.eventId);
    if (!event) {
       resultEl.classList.add('bg-[rgba(255,77,109,0.1)]', 'text-[var(--accent)]', 'border', 'border-[rgba(255,77,109,0.3)]');
       resultEl.innerHTML = `<i class="fas fa-circle-xmark text-lg mb-1"></i><br>Event not found for ticket: ${this.esc(ticketCode)}`;
       return;
    }

    if (booking.checkedIn) {
      resultEl.classList.add('bg-[rgba(255,182,39,0.1)]', 'text-[#b45309]', 'border', 'border-[rgba(255,182,39,0.3)]');
      resultEl.innerHTML = `<i class="fas fa-triangle-exclamation text-lg mb-1"></i><br>Already Checked In!<br><span class="text-xs font-normal">Ticket: ${booking.ticketCode} &bull; Name: ${this.esc(booking.name)}</span>`;
      return;
    }

    // Mark as checked in
    db.collection('bookings').doc(booking.id).update({ checkedIn: true }).then(() => {
      resultEl.classList.add('bg-[rgba(0,230,118,0.1)]', 'text-[var(--success)]', 'border', 'border-[rgba(0,230,118,0.3)]');
      resultEl.innerHTML = `<i class="fas fa-circle-check text-lg mb-1"></i><br>Verified &amp; Checked In!<br><span class="text-xs font-normal text-black mt-1 block"><b>${this.esc(booking.name)}</b> for ${this.esc(event.title)}</span>`;
      // Log check-in to activity log
      db.collection('activityLogs').add({
        ticketCode: ticketCode,
        attendeeName: booking.fullName || booking.name || '',
        eventId: booking.eventId,
        eventTitle: event ? event.title : '',
        action: 'check_in',
        checkedInAt: new Date().toISOString()
      });
    }).catch(err => {
      console.error(err);
      this.toast('Failed to check in', 'error');
    });
  },

  onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning
  },

  // ===================== MANUAL TICKET LOOKUP =====================
  manualTicketLookup() {
    const input = document.getElementById('manualTicketCode');
    const resultEl = document.getElementById('manualScannerResult');
    if (!input || !resultEl) return;

    const ticketCode = input.value.trim().toUpperCase();
    if (!ticketCode) {
      this.toast('Please enter a ticket code', 'error');
      input.focus();
      return;
    }

    // Reset result element classes fully
    resultEl.className = 'p-4 rounded-xl text-sm font-semibold mt-4 text-center';

    const booking = this.bookings.find(b => b.ticketCode === ticketCode);

    if (!booking) {
      resultEl.classList.add('bg-[rgba(255,77,109,0.1)]', 'text-[var(--accent)]', 'border', 'border-[rgba(255,77,109,0.3)]');
      resultEl.innerHTML = `
        <i class="fas fa-circle-xmark text-2xl mb-2 block"></i>
        <div class="font-bold">Invalid Ticket Code</div>
        <div class="text-xs font-normal mt-1 opacity-80">No booking found for <span class="font-mono font-bold">${this.esc(ticketCode)}</span></div>
      `;
      input.select();
      return;
    }

    const event = this.events.find(e => e.id === booking.eventId);

    if (!event) {
      resultEl.classList.add('bg-[rgba(255,77,109,0.1)]', 'text-[var(--accent)]', 'border', 'border-[rgba(255,77,109,0.3)]');
      resultEl.innerHTML = `<i class="fas fa-circle-xmark text-2xl mb-2 block"></i><div class="font-bold">Event not found for this ticket</div>`;
      input.select();
      return;
    }

    if (booking.checkedIn) {
      resultEl.classList.add('bg-[rgba(255,182,39,0.1)]', 'text-[#b45309]', 'border', 'border-[rgba(255,182,39,0.3)]');
      resultEl.innerHTML = `
        <i class="fas fa-triangle-exclamation text-2xl mb-2 block"></i>
        <div class="font-bold">Already Checked In!</div>
        <div class="text-xs font-normal mt-1 opacity-80">
          <span class="font-mono font-bold">${this.esc(booking.ticketCode)}</span> &bull;
          ${this.esc(booking.fullName || booking.name || '')}
        </div>
        <div class="text-xs font-normal mt-0.5 opacity-70">${this.esc(event.title)}</div>
      `;
      input.select();
      return;
    }

    // Disable button while processing
    const btn = document.getElementById('manualLookupBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...'; }

    // Mark as checked in
    db.collection('bookings').doc(booking.id).update({ checkedIn: true }).then(() => {
      resultEl.classList.add('bg-[rgba(0,230,118,0.1)]', 'text-[var(--success)]', 'border', 'border-[rgba(0,230,118,0.3)]');
      resultEl.innerHTML = `
        <i class="fas fa-circle-check text-2xl mb-2 block"></i>
        <div class="font-bold">Verified & Checked In!</div>
        <div class="text-xs font-normal text-black mt-2">
          <span class="font-bold text-base">${this.esc(booking.fullName || booking.name || '')}</span><br>
          <span class="opacity-70">${this.esc(event.title)}</span>
        </div>
        ${booking.school ? `<div class="text-xs mt-1 opacity-60">${this.esc(booking.school)}</div>` : ''}
      `;

      // Log check-in
      db.collection('activityLogs').add({
        ticketCode: ticketCode,
        attendeeName: booking.fullName || booking.name || '',
        eventId: booking.eventId,
        eventTitle: event ? event.title : '',
        action: 'check_in',
        checkedInAt: new Date().toISOString()
      });

      // Clear input and re-focus for next scan
      input.value = '';
      input.focus();
    }).catch(err => {
      console.error(err);
      resultEl.classList.add('bg-[rgba(255,77,109,0.1)]', 'text-[var(--accent)]', 'border', 'border-[rgba(255,77,109,0.3)]');
      resultEl.innerHTML = `<i class="fas fa-circle-xmark text-2xl mb-2 block"></i><div class="font-bold">Failed to check in. Try again.</div>`;
    }).finally(() => {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Check In'; }
    });
  },



  renderAdminStats() {
    const activeEvents = this.events.filter(e => e.active);
    
    let totalRevenue = 0;
    this.bookings.forEach(b => {
      const event = this.events.find(e => e.id === b.eventId);
      if (event) {
        const tier = (event.tiers || []).find(t => t.id === b.tierId);
        if (tier) totalRevenue += tier.price;
      }
    });

    document.getElementById('statEvents').textContent = activeEvents.length;
    document.getElementById('statBookings').textContent = this.bookings.length;
    document.getElementById('statRevenue').textContent = 'KES ' + totalRevenue.toLocaleString();
    document.getElementById('statWaitlists').textContent = this.waitlists.length;
    const wlBadge = document.getElementById('sidebarWaitlistCount');
    if (wlBadge) wlBadge.textContent = this.waitlists.length;

    // Update sidebar badges
    const sidebarEventCount = document.getElementById('sidebarEventCount');
    if (sidebarEventCount) sidebarEventCount.textContent = this.events.length;
    
    const sidebarBookingCount = document.getElementById('sidebarBookingCount');
    if (sidebarBookingCount) sidebarBookingCount.textContent = this.bookings.length;

    // Update settings data management counts
    const settingsEventCount = document.getElementById('settingsEventCount');
    if (settingsEventCount) settingsEventCount.textContent = `${this.events.length} events stored`;
    
    const settingsBookingCount = document.getElementById('settingsBookingCount');
    if (settingsBookingCount) settingsBookingCount.textContent = `${this.bookings.length} bookings stored`;
  },

  renderAdminEvents() {
    const list = document.getElementById('adminEventsList');
    const noMsg = document.getElementById('noAdminEvents');

    if (this.events.length === 0) {
      list.innerHTML = '';
      noMsg.classList.remove('hidden');
      return;
    }
    noMsg.classList.add('hidden');

    const sortedEvents = [...this.events].sort((a, b) => new Date(b.date) - new Date(a.date));

    const bulkToolbar = `
      <div id="bulkToolbar" class="hidden mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-wrap items-center gap-3 animate-fadeIn">
        <i class="fas fa-layer-group text-[var(--accent2)]"></i>
        <span id="bulkSelectedCount" class="text-sm font-semibold">0 selected</span>
        <div class="flex gap-2 ml-auto flex-wrap">
          <button onclick="App.bulkSetActive(true)" class="btn-secondary btn-sm"><i class="fas fa-eye"></i> Activate</button>
          <button onclick="App.bulkSetActive(false)" class="btn-secondary btn-sm"><i class="fas fa-eye-slash"></i> Deactivate</button>
          <button onclick="App.bulkDeleteEvents()" class="btn-secondary btn-sm" style="color:var(--accent);border-color:rgba(255,77,109,0.3)"><i class="fas fa-trash"></i> Delete Selected</button>
        </div>
      </div>
    `;

    const selectAllBar = `
      <div class="flex items-center gap-3 mb-3 px-1">
        <input type="checkbox" id="selectAllEvents" class="w-4 h-4 cursor-pointer"
               onchange="App.selectAllEvents(this.checked)"
               ${this.selectedEvents.size === this.events.length && this.events.length > 0 ? 'checked' : ''}>
        <label for="selectAllEvents" class="text-xs text-[var(--muted)] cursor-pointer select-none">Select all events</label>
        ${this.selectedEvents.size > 0 ? `<span class="text-xs font-semibold text-[var(--accent2)] ml-2">${this.selectedEvents.size} selected</span>` : ''}
      </div>
    `;

    list.innerHTML = bulkToolbar + selectAllBar + sortedEvents.map(event => {
      const totalSlots = (event.tiers || []).reduce((sum, t) => sum + t.totalSlots, 0);
      const bookedSlots = (event.tiers || []).reduce((sum, t) => sum + t.bookedSlots, 0);
      const minPrice = (event.tiers || []).reduce((min, t) => t.price < min ? t.price : min, Infinity);
      const slotsLeft = totalSlots - bookedSlots;
      const pct = Math.round((bookedSlots / totalSlots) * 100);
      const isEnded = new Date(event.date + 'T23:59:59') < new Date();
      const imgSeed = event.image || event.title.replace(/\s/g,'');
      const isSelected = this.selectedEvents.has(event.id);
      const adminImgSrc = event.image && event.image.startsWith('http') ? event.image : `https://picsum.photos/seed/${encodeURIComponent(imgSeed)}/200/130.jpg`;

      return `
        <div class="glass rounded-xl p-4 sm:p-5 flex gap-3 items-start transition-all ${isSelected ? 'ring-2 ring-[var(--accent2)]' : ''}" id="event-card-${event.id}">
          <div class="flex flex-col items-center gap-3 pt-1 shrink-0">
            <input type="checkbox" class="w-4 h-4 cursor-pointer" id="chk-${event.id}"
                   onchange="App.toggleEventSelection('${event.id}')"
                   ${isSelected ? 'checked' : ''}>
          </div>
          <img src="${adminImgSrc}" class="w-20 h-16 sm:w-28 sm:h-20 rounded-lg object-cover shrink-0 hidden sm:block" alt="" onerror="this.style.display='none'">
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <h4 class="font-bold text-base sm:text-lg">${this.esc(event.title)}</h4>
                <div class="flex flex-wrap gap-1.5 mt-1">
                  <span class="badge ${event.type === 'school' ? 'badge-school' : 'badge-normal'}">
                    <i class="fas ${event.type === 'school' ? 'fa-building-columns' : 'fa-globe'}"></i>
                    ${this.esc(event.type === 'school' ? event.school || 'School' : 'Open Event')}
                  </span>
                  ${event.featured ? '<span class="badge" style="background:rgba(255,182,39,0.15);color:var(--accent2);border-color:rgba(255,182,39,0.3)"><i class="fas fa-star"></i> Featured</span>' : ''}
                  ${isEnded ? '<span class="badge badge-ended">Ended</span>' : ''}
                  ${!event.active ? '<span class="badge badge-ended">Inactive</span>' : ''}
                </div>
              </div>
              <div class="flex gap-1.5 shrink-0 flex-wrap justify-end">
                <button onclick="App.toggleEventFeatured('${event.id}')" class="btn-secondary btn-sm" title="${event.featured ? 'Unpin from Featured' : 'Pin as Featured'}" style="${event.featured ? 'color:var(--accent2);border-color:rgba(255,182,39,0.4)' : ''}">
                  <i class="fas fa-star"></i>
                </button>
                <button onclick="App.showPromoQR('${event.id}')" class="btn-secondary btn-sm" title="Share Promo QR" style="color:var(--info)">
                  <i class="fas fa-qrcode"></i>
                </button>
                <button onclick="App.editEvent('${event.id}')" class="btn-secondary btn-sm" title="Edit"><i class="fas fa-pen"></i></button>
                <button onclick="App.toggleEventActive('${event.id}')" class="btn-secondary btn-sm" title="${event.active ? 'Deactivate' : 'Activate'}">
                  <i class="fas ${event.active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
                <button onclick="App.showDeleteModal('event','${event.id}')" class="btn-secondary btn-sm" title="Delete" style="color:var(--accent)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="flex flex-wrap gap-3 text-xs text-[var(--muted)] mb-3">
              <span><i class="fas fa-calendar"></i> ${this.formatDate(event.date)}</span>
              <span><i class="fas fa-clock"></i> ${this.formatTime(event.time)}</span>
              <span><i class="fas fa-location-dot"></i> ${this.esc(event.venue)}</span>
              <span><i class="fas fa-tag"></i> ${minPrice > 0 && minPrice !== Infinity ? 'KES ' + minPrice.toLocaleString() : 'Free'}</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex-1 h-1.5 rounded-full bg-[var(--card)]">
                <div class="h-1.5 rounded-full transition-all" style="width:${pct}%;background:${pct >= 100 ? 'var(--accent)' : pct >= 80 ? 'var(--accent2)' : 'var(--success)'}"></div>
              </div>
              <span class="text-xs font-semibold shrink-0">${bookedSlots}/${totalSlots}</span>
              <span class="text-xs text-[var(--muted)] shrink-0">(${slotsLeft} left)</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.updateBulkToolbar();
  },

  toggleEventFeatured(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    const newFeatured = !event.featured;
    db.collection('events').doc(eventId).update({ featured: newFeatured }).then(() => {
      this.toast(newFeatured ? '⭐ Event pinned as Featured!' : 'Event unpinned from Featured', newFeatured ? 'success' : 'info');
    });
  },

  toggleEventSelection(eventId) {
    if (this.selectedEvents.has(eventId)) {
      this.selectedEvents.delete(eventId);
    } else {
      this.selectedEvents.add(eventId);
    }
    // Update visual ring on card
    const card = document.getElementById('event-card-' + eventId);
    if (card) {
      if (this.selectedEvents.has(eventId)) {
        card.classList.add('ring-2', 'ring-[var(--accent2)]');
      } else {
        card.classList.remove('ring-2', 'ring-[var(--accent2)]');
      }
    }
    this.updateBulkToolbar();
  },

  selectAllEvents(checked) {
    if (checked) {
      this.events.forEach(e => this.selectedEvents.add(e.id));
    } else {
      this.selectedEvents.clear();
    }
    this.renderAdminEvents();
  },

  updateBulkToolbar() {
    const toolbar = document.getElementById('bulkToolbar');
    const countEl = document.getElementById('bulkSelectedCount');
    if (!toolbar) return;
    const count = this.selectedEvents.size;
    if (count > 0) {
      toolbar.classList.remove('hidden');
      if (countEl) countEl.textContent = `${count} event${count !== 1 ? 's' : ''} selected`;
    } else {
      toolbar.classList.add('hidden');
    }
  },

  bulkSetActive(activate) {
    if (this.selectedEvents.size === 0) return;
    const ids = [...this.selectedEvents];
    const batch = db.batch();
    ids.forEach(id => batch.update(db.collection('events').doc(id), { active: activate }));
    batch.commit().then(() => {
      this.toast(`${ids.length} event(s) ${activate ? 'activated' : 'deactivated'}`, 'success');
      this.selectedEvents.clear();
    });
  },

  bulkDeleteEvents() {
    if (this.selectedEvents.size === 0) return;
    const ids = [...this.selectedEvents];
    const count = ids.length;
    document.getElementById('deleteMessage').textContent = `Delete ${count} selected event(s)? All associated bookings will also be removed. This cannot be undone.`;
    this.deleteCallback = {
      type: 'bulk_event',
      ids
    };
    this.openModal('deleteModal');
  },

  renderActivityLogs() {
    const body = document.getElementById('activityLogBody');
    const noMsg = document.getElementById('noActivityLog');
    const table = document.getElementById('activityLogTable');
    // Update sidebar badge
    const badge = document.getElementById('sidebarLogCount');
    if (badge) badge.textContent = this.activityLogs.length;
    if (!body) return;
    if (this.activityLogs.length === 0) {
      body.innerHTML = '';
      if (noMsg) noMsg.classList.remove('hidden');
      if (table) table.classList.add('hidden');
      return;
    }
    if (noMsg) noMsg.classList.add('hidden');
    if (table) table.classList.remove('hidden');
    body.innerHTML = this.activityLogs.map(log => {
      const timeAgo = this.timeAgo(log.checkedInAt);
      return `
        <tr>
          <td class="text-xs text-[var(--muted)]" title="${new Date(log.checkedInAt).toLocaleString()}">${timeAgo}</td>
          <td>
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold" style="background:rgba(0,230,118,0.12);color:var(--success)">
              <i class="fas fa-check-circle"></i> Check-In
            </span>
          </td>
          <td class="font-mono text-xs text-gradient font-bold">${this.esc(log.ticketCode || '-')}</td>
          <td class="font-semibold text-sm">${this.esc(log.attendeeName || '-')}</td>
          <td class="text-[var(--muted)] text-sm">${this.esc(log.eventTitle || '-')}</td>
        </tr>
      `;
    }).join('');
  },

  clearActivityLog() {
    if (!confirm('Clear the entire activity log? This cannot be undone.')) return;
    const batch = db.batch();
    this.activityLogs.forEach(log => batch.delete(db.collection('activityLogs').doc(log.id)));
    batch.commit().then(() => this.toast('Activity log cleared', 'info'));
  },

  timeAgo(isoString) {
    if (!isoString) return '-';
    const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString();
  },

  renderRecentBookings() {
    const body = document.getElementById('recentBookingsBody');
    const noMsg = document.getElementById('noRecentBookings');
    const recent = [...this.bookings].sort((a,b) => new Date(b.bookedAt) - new Date(a.bookedAt)).slice(0, 5);

    if (recent.length === 0) {
      body.innerHTML = '';
      noMsg.classList.remove('hidden');
      document.getElementById('recentBookingsTable').classList.add('hidden');
      return;
    }
    noMsg.classList.add('hidden');
    document.getElementById('recentBookingsTable').classList.remove('hidden');

    body.innerHTML = recent.map(b => {
      const ev = this.events.find(e => e.id === b.eventId);
      return `
        <tr>
          <td class="font-semibold">${this.esc(b.fullName)}</td>
          <td class="text-[var(--muted)]">${this.esc(ev ? ev.title : 'Unknown')}</td>
          <td class="text-[var(--muted)]">${this.esc(b.phone)}</td>
          <td class="text-[var(--muted)]">${new Date(b.bookedAt).toLocaleDateString()}</td>
          <td>
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-gradient">${this.esc(b.ticketCode)}</span>
              ${b.checkedIn ? '<i class="fas fa-check-circle text-[var(--success)]" title="Checked In"></i>' : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderAdminBookings() {
    const body = document.getElementById('allBookingsBody');
    const noMsg = document.getElementById('noAllBookings');
    const filterEvent = document.getElementById('filterBookingEvent').value;

    let filtered = [...this.bookings];
    if (filterEvent !== 'all') filtered = filtered.filter(b => b.eventId === filterEvent);
    filtered.sort((a,b) => new Date(b.bookedAt) - new Date(a.bookedAt));

    if (filtered.length === 0) {
      body.innerHTML = '';
      noMsg.classList.remove('hidden');
      return;
    }
    noMsg.classList.add('hidden');

    body.innerHTML = filtered.map(b => {
      const ev = this.events.find(e => e.id === b.eventId);
      return `
        <tr>
          <td>
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-gradient">${this.esc(b.ticketCode)}</span>
              ${b.checkedIn ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(0,230,118,0.1)] text-[var(--success)]">SCANNED</span>' : ''}
            </div>
          </td>
          <td class="font-semibold">${this.esc(b.fullName)}</td>
          <td class="text-[var(--muted)]">${this.esc(b.phone)}</td>
          <td class="text-[var(--muted)]">${this.esc(b.regNumber || '-')}</td>
          <td class="text-[var(--muted)]">${this.esc(ev ? ev.title : 'Deleted')}</td>
          <td class="text-[var(--muted)]">${new Date(b.bookedAt).toLocaleString()}</td>
          <td>
            <button onclick="App.showDeleteModal('booking','${b.id}')" class="btn-secondary btn-sm" style="color:var(--accent);padding:4px 8px;">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateBookingFilterDropdown() {
    const select = document.getElementById('filterBookingEvent');
    const current = select.value;
    select.innerHTML = '<option value="all">All Events</option>';
    this.events.forEach(e => {
      select.innerHTML += `<option value="${e.id}">${this.esc(e.title)}</option>`;
    });
    select.value = current;
  },

  // ===================== ADMIN WAITLIST =====================
  updateWaitlistFilterDropdown() {
    const select = document.getElementById('filterWaitlistEvent');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="all">All Events</option>';
    // Only show events that actually have waitlist entries
    const eventIdsWithWaitlist = [...new Set(this.waitlists.map(w => w.eventId))];
    this.events
      .filter(e => eventIdsWithWaitlist.includes(e.id))
      .forEach(e => {
        select.innerHTML += `<option value="${e.id}">${this.esc(e.title)}</option>`;
      });
    // Fallback: if current selection still valid, keep it
    if ([...select.options].some(o => o.value === current)) select.value = current;
  },

  renderAdminWaitlist() {
    const body = document.getElementById('waitlistTableBody');
    const noMsg = document.getElementById('noWaitlistMsg');
    if (!body) return;

    const filterEventId = document.getElementById('filterWaitlistEvent')?.value || 'all';
    let list = [...this.waitlists];
    if (filterEventId !== 'all') list = list.filter(w => w.eventId === filterEventId);
    list.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)); // oldest first = highest priority

    if (list.length === 0) {
      body.innerHTML = '';
      if (noMsg) noMsg.classList.remove('hidden');
      return;
    }
    if (noMsg) noMsg.classList.add('hidden');

    body.innerHTML = list.map((w, idx) => {
      const ev = this.events.find(e => e.id === w.eventId);
      const tier = ev ? (ev.tiers || []).find(t => t.id === w.tierId) : null;
      const tierFull = tier ? tier.bookedSlots >= tier.totalSlots : true;
      const slotsLeft = tier ? Math.max(0, tier.totalSlots - tier.bookedSlots) : 0;
      const canPromote = !tierFull && ev;

      return `
        <tr>
          <td class="text-[var(--muted)] font-mono text-xs">#${idx + 1}</td>
          <td class="font-semibold">${this.esc(w.fullName)}</td>
          <td class="text-[var(--muted)]">${this.esc(w.phone)}</td>
          <td class="text-[var(--muted)]">${this.esc(w.regNumber || '—')}</td>
          <td class="text-[var(--muted)]">${this.esc(ev ? ev.title : 'Deleted')}</td>
          <td>
            <span class="px-2 py-0.5 rounded text-[11px] font-bold" style="background:var(--accent2-soft);color:var(--accent2)">
              ${this.esc(tier ? tier.name : '—')}
            </span>
          </td>
          <td class="text-[var(--muted)] text-xs">${new Date(w.joinedAt).toLocaleString()}</td>
          <td>
            <div class="flex items-center gap-2">
              ${canPromote
                ? `<button onclick="App.promoteWaitlistEntry('${w.id}')" class="btn-sm font-semibold flex items-center gap-1.5" style="background:var(--success-soft);color:var(--success);border:1px solid rgba(5,150,105,0.2);padding:5px 10px;border-radius:8px;" title="${slotsLeft} slot(s) available">
                    <i class="fas fa-arrow-up text-xs"></i> Promote
                   </button>`
                : `<span class="text-xs text-[var(--muted)] italic">Tier full</span>`
              }
              <button onclick="App.removeWaitlistEntry('${w.id}')" class="btn-secondary btn-sm" style="color:var(--accent);padding:4px 8px;" title="Remove from waitlist">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  promoteWaitlistEntry(waitlistId) {
    const wl = this.waitlists.find(w => w.id === waitlistId);
    if (!wl) { this.toast('Waitlist entry not found', 'error'); return; }

    const event = this.events.find(e => e.id === wl.eventId);
    if (!event) { this.toast('Event not found', 'error'); return; }

    const tier = (event.tiers || []).find(t => t.id === wl.tierId);
    if (!tier) { this.toast('Tier not found', 'error'); return; }

    if (tier.bookedSlots >= tier.totalSlots) {
      this.toast(`No slots available in the "${tier.name}" tier to promote this person.`, 'error');
      return;
    }

    // Confirm before promoting
    if (!confirm(`Promote ${wl.fullName} from the waitlist to a confirmed booking for "${event.title}" (${tier.name} tier)?`)) return;

    const ticketCode = this.genTicketCode();
    const newBooking = {
      id: this.uid(),
      eventId: wl.eventId,
      tierId: wl.tierId,
      fullName: wl.fullName,
      phone: wl.phone,
      regNumber: wl.regNumber || '',
      school: wl.school || '',
      bookedAt: new Date().toISOString(),
      ticketCode,
      promotedFromWaitlist: true
    };

    const batch = db.batch();
    // 1. Create the booking
    batch.set(db.collection('bookings').doc(newBooking.id), newBooking);
    // 2. Remove from waitlist
    batch.delete(db.collection('waitlists').doc(waitlistId));
    // 3. Increment bookedSlots on the tier
    tier.bookedSlots = (tier.bookedSlots || 0) + 1;
    batch.update(db.collection('events').doc(event.id), { tiers: event.tiers });

    batch.commit().then(() => {
      this.toast(`✅ ${wl.fullName} has been promoted to a confirmed booking! Ticket: ${ticketCode}`, 'success');
      this.renderAdminWaitlist();
      this.renderAdminStats();
    }).catch(err => {
      console.error('Promotion error:', err);
      this.toast('Failed to promote waitlist entry. Please try again.', 'error');
      // Revert optimistic tier update
      tier.bookedSlots = Math.max(0, tier.bookedSlots - 1);
    });
  },

  removeWaitlistEntry(waitlistId) {
    if (!confirm('Remove this person from the waitlist?')) return;
    db.collection('waitlists').doc(waitlistId).delete()
      .then(() => this.toast('Waitlist entry removed.', 'success'))
      .catch(() => this.toast('Failed to remove entry.', 'error'));
  },

  // ===================== CREATE/EDIT EVENT =====================
  toggleEventFields() {
    const type = document.getElementById('eventType').value;
    const schoolField = document.getElementById('eventSchoolField');
    if (type === 'school') {
      schoolField.style.display = 'block';
      document.getElementById('eventSchool').required = true;
    } else {
      schoolField.style.display = 'none';
      document.getElementById('eventSchool').required = false;
      document.getElementById('eventSchool').value = '';
    }
  },

  addEventTier(tier = null) {
    const container = document.getElementById('eventTiersContainer');
    const tierId = tier ? tier.id : 'tier-' + this.uid();
    const name = tier ? this.esc(tier.name) : '';
    const price = tier ? tier.price : 0;
    const slots = tier ? tier.totalSlots : 100;
    
    const div = document.createElement('div');
    div.className = 'tier-row flex gap-2 items-start';
    div.dataset.id = tierId;
    div.innerHTML = `
      <div class="flex-1">
        <input type="text" class="form-input tier-name text-sm" placeholder="Name (e.g VIP)" value="${name}" required>
      </div>
      <div class="w-24">
        <input type="number" class="form-input tier-price text-sm" placeholder="KES" value="${price}" min="0" required>
      </div>
      <div class="w-24">
        <input type="number" class="form-input tier-slots text-sm" placeholder="Slots" value="${slots}" min="1" required>
      </div>
      <button type="button" onclick="this.parentElement.remove()" class="btn-secondary btn-sm shrink-0" style="color:var(--accent);padding:8px 12px;"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(div);
  },

  renderEventTiersAdmin(tiers) {
    const container = document.getElementById('eventTiersContainer');
    container.innerHTML = '';
    if (!tiers || tiers.length === 0) {
      this.addEventTier({ id: 'tier-' + this.uid(), name: 'General Admission', price: 0, totalSlots: 100 });
    } else {
      tiers.forEach(t => this.addEventTier(t));
    }
  },

  async saveEvent(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveEventBtn');
    
    const editId = document.getElementById('editEventId').value;
    const type = document.getElementById('eventType').value;
    const title = document.getElementById('eventTitle').value.trim();
    const desc = document.getElementById('eventDesc').value.trim();
    const school = document.getElementById('eventSchool').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const venue = document.getElementById('eventVenue').value.trim();
    const mapQuery = document.getElementById('eventMapQuery')?.value.trim() || '';
    const allowMultiple = document.getElementById('eventAllowMultiple').checked;
    const imageInput = document.getElementById('eventImage').value.trim();
    const unsplashSelectedUrl = document.getElementById('unsplashSelectedUrl') ? document.getElementById('unsplashSelectedUrl').value : '';
    const imageFile = document.getElementById('eventImageFile') ? document.getElementById('eventImageFile').files[0] : null;

    let image = `https://picsum.photos/seed/${this.uid()}/800/600`;
    const origText = saveBtn.textContent;
    
    // Check for images in this order: Uploaded File > Unsplash > Keyword > Fallback
    try {
      if (imageFile) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        saveBtn.parentElement.disabled = true;
        image = await this.uploadImageToCloudinary(imageFile);
      } else if (unsplashSelectedUrl) {
        image = unsplashSelectedUrl;
      } else if (imageInput) {
        const kw = imageInput.toLowerCase();
        if (kw.includes('party') || kw.includes('dj') || kw.includes('rave') || kw.includes('concert')) {
          image = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop';
        } else if (kw.includes('gala') || kw.includes('ball') || kw.includes('formal') || kw.includes('runway') || kw.includes('fashion')) {
          image = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=600&fit=crop';
        } else if (kw.includes('tech') || kw.includes('hackathon') || kw.includes('coding') || kw.includes('startup')) {
          image = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop';
        } else if (kw.includes('business') || kw.includes('summit') || kw.includes('network')) {
          image = 'https://images.unsplash.com/photo-1551818255-e6e10975bc17?w=800&h=600&fit=crop';
        } else {
          image = `https://source.unsplash.com/800x600/?${encodeURIComponent(imageInput)}`;
        }
      }
    } catch (err) {
      this.toast(err.message || 'Image upload failed. Check Cloudinary settings.', 'error');
      saveBtn.textContent = origText;
      saveBtn.parentElement.disabled = false;
      return;
    } finally {
      saveBtn.textContent = origText;
      saveBtn.parentElement.disabled = false;
    }
    const maxTickets = parseInt(document.getElementById('eventMaxTickets').value) || 5;

    const tiersNodes = document.querySelectorAll('#eventTiersContainer .tier-row');
    const newTiers = Array.from(tiersNodes).map(node => {
      return {
        id: node.dataset.id,
        name: node.querySelector('.tier-name').value.trim(),
        price: parseInt(node.querySelector('.tier-price').value) || 0,
        totalSlots: parseInt(node.querySelector('.tier-slots').value) || 1,
        bookedSlots: 0 // Will adjust later for edit
      };
    });
    
    if (newTiers.length === 0) {
      this.toast('At least one ticket tier is required.', 'error');
      return;
    }

    if (type === 'school' && !school) {
      this.toast('Please select a school for school events', 'error');
      return;
    }

    if (editId) {
      // Update existing
      const event = this.events.find(ev => ev.id === editId);
      if (event) {
        event.title = title;
        event.description = desc;
        event.type = type;
        event.school = type === 'school' ? school : '';
        event.date = date;
        event.time = time;
        event.venue = venue;
        event.mapQuery = mapQuery;
        event.image = image;
        event.allowMultiple = allowMultiple;
        event.maxTickets = maxTickets;
        
        event.tiers = newTiers.map(nt => {
          const existingTier = (event.tiers || []).find(et => et.id === nt.id);
          if (existingTier) {
            nt.bookedSlots = existingTier.bookedSlots > nt.totalSlots ? nt.totalSlots : existingTier.bookedSlots;
          }
          return nt;
        });
      }
      db.collection('events').doc(event.id).set(event).then(() => {
        this.toast('Event updated successfully', 'success');
      });
    } else {
      // Create new
      const newEvent = {
        id: this.uid(),
        title, description: desc, type, school: type === 'school' ? school : '',
        date, time, venue, mapQuery, image, active: true, createdAt: new Date().toISOString(),
        allowMultiple, maxTickets,
        tiers: newTiers
      };
      db.collection('events').doc(newEvent.id).set(newEvent).then(() => {
        this.toast('Event created successfully', 'success');
      });
    }

    this.resetEventForm();
    this.setAdminTab('events');
  },

  editEvent(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;

    // Set the flag so setAdminTab won't reset the form
    this._isEditing = true;

    document.getElementById('editEventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDesc').value = event.description;
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventSchool').value = event.school;
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventTime').value = event.time;
    document.getElementById('eventVenue').value = event.venue;
    if (document.getElementById('eventMapQuery')) {
      document.getElementById('eventMapQuery').value = event.mapQuery || '';
    }
    document.getElementById('eventImage').value = event.image;
    document.getElementById('eventAllowMultiple').checked = event.allowMultiple || false;
    document.getElementById('eventMaxTickets').value = event.maxTickets || 5;
    document.getElementById('maxTicketsWrapper').style.display = event.allowMultiple ? 'block' : 'none';
    
    this.renderEventTiersAdmin(event.tiers);

    this.toggleEventFields();
    document.getElementById('createEventTitle').textContent = 'Edit Event';
    document.getElementById('saveEventBtn').textContent = 'Update Event';
    this.setAdminTab('create');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  toggleEventActive(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      db.collection('events').doc(eventId).update({ active: !event.active }).then(() => {
        this.toast(`Event ${!event.active ? 'activated' : 'deactivated'}`, 'info');
      });
    }
  },

  resetEventForm() {
    document.getElementById('eventForm').reset();
    document.getElementById('editEventId').value = '';
    if (document.getElementById('eventMapQuery')) {
      document.getElementById('eventMapQuery').value = '';
    }
    document.getElementById('createEventTitle').textContent = 'Create New Event';
    document.getElementById('saveEventBtn').textContent = 'Create Event';
    document.getElementById('eventSchoolField').style.display = 'none';
    document.getElementById('eventSchool').required = false;
    document.getElementById('eventAllowMultiple').checked = false;
    document.getElementById('eventMaxTickets').value = 5;
    document.getElementById('maxTicketsWrapper').style.display = 'none';
    this.renderEventTiersAdmin([]);
  },

  // ===================== DELETE =====================
  showDeleteModal(type, id) {
    let msg = '';
    if (type === 'event') {
      const ev = this.events.find(e => e.id === id);
      msg = `Delete "${ev ? ev.title : 'this event'}"? All associated bookings will also be removed.`;
    } else {
      msg = 'Cancel this booking? This action cannot be undone.';
    }
    document.getElementById('deleteMessage').textContent = msg;
    this.deleteCallback = { type, id };
    this.openModal('deleteModal');
  },

  closeDeleteModal() {
    this.closeModal('deleteModal');
    this.deleteCallback = null;
  },

  // ===================== PROMO QR =====================
  showPromoQR(eventId) {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;
    
    let baseUrl = window.location.origin + window.location.pathname;
    baseUrl = baseUrl.replace('admin.html', 'index.html');
    if (!baseUrl.endsWith('index.html')) {
        if (!baseUrl.endsWith('/')) baseUrl += '/';
        baseUrl += 'index.html';
    }
    const promoUrl = `${baseUrl}?event=${eventId}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(promoUrl)}`;
    
    document.getElementById('qrPromoImageContainer').innerHTML = `
      <img src="${qrUrl}" alt="QR Promo" class="rounded-xl border border-[var(--border)] p-2 bg-white shadow-sm" width="200" height="200">
    `;
    
    const downloadBtn = document.getElementById('downloadPromoQrBtn');
    if (downloadBtn) {
      downloadBtn.href = qrUrl;
      downloadBtn.target = '_blank';
      downloadBtn.download = `${event.title.replace(/\s+/g, '-')}-promo-qr.png`;
    }
    
    this.openModal('qrPromoModal');
  },

  confirmDelete() {
    if (!this.deleteCallback) return;
    const { type, id, ids } = this.deleteCallback;

    if (type === 'bulk_event') {
      const batch = db.batch();
      ids.forEach(eid => {
        batch.delete(db.collection('events').doc(eid));
        this.bookings.filter(b => b.eventId === eid).forEach(b => batch.delete(db.collection('bookings').doc(b.id)));
      });
      batch.commit().then(() => {
        this.toast(`${ids.length} event(s) deleted`, 'success');
        this.selectedEvents.clear();
      });
    } else if (type === 'event') {
      // Remove event
      db.collection('events').doc(id).delete().then(() => {
        // Optionally delete all bookings for this event (Firestore does not cascade delete automatically)
        const batch = db.batch();
        this.bookings.filter(b => b.eventId === id).forEach(b => {
          batch.delete(db.collection('bookings').doc(b.id));
        });
        batch.commit();
        this.toast('Event deleted successfully', 'success');
      });
    } else if (type === 'booking') {
      const booking = this.bookings.find(b => b.id === id);
      if (booking) {
        db.collection('bookings').doc(id).delete().then(() => {
          // Free up slot in tier
          const event = this.events.find(e => e.id === booking.eventId);
          if (event) {
            const tier = event.tiers.find(t => t.id === booking.tierId);
            if (tier && tier.bookedSlots > 0) {
              tier.bookedSlots--;
              db.collection('events').doc(event.id).update({ tiers: event.tiers });
            }
          }
          this.toast('Booking cancelled', 'success');
        });
      }
    }

    this.closeDeleteModal();
  },

  // ===================== EXPORT =====================
  exportBookings() {
    const filterEvent = document.getElementById('filterBookingEvent').value;
    let filtered = [...this.bookings];
    if (filterEvent !== 'all') filtered = filtered.filter(b => b.eventId === filterEvent);

    if (filtered.length === 0) {
      this.toast('No bookings to export', 'error');
      return;
    }

    let csv = 'Ticket Code,Full Names,Phone,Reg Number,School,Event,Date,Time,Venue,Booked At\n';
    filtered.forEach(b => {
      const ev = this.events.find(e => e.id === b.eventId);
      csv += `"${b.ticketCode}","${b.fullName}","${b.phone}","${b.regNumber}","${b.school}","${ev ? ev.title : 'Deleted'}","${ev ? ev.date : ''}","${ev ? ev.time : ''}","${ev ? ev.venue : ''}","${new Date(b.bookedAt).toLocaleString()}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'univibe-bookings.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.toast('Bookings exported as CSV', 'success');
  },

  // ===================== ADMIN SETTINGS =====================
  changePassword(e) {
    e.preventDefault();
    const current = document.getElementById('currentPwd').value;
    const newPwd = document.getElementById('newPwd').value;
    const confirm = document.getElementById('confirmPwd').value;

    if (newPwd.length < 6) {
      this.toast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPwd !== confirm) {
      this.toast('New passwords do not match', 'error');
      return;
    }

    const auth = window.firebase && firebase.auth ? firebase.auth() : null;
    if (!auth || !auth.currentUser) {
      this.toast('You must be logged in to change your password', 'error');
      return;
    }

    // Re-authenticate user before changing password
    const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, current);
    
    auth.currentUser.reauthenticateWithCredential(credential).then(() => {
      auth.currentUser.updatePassword(newPwd).then(() => {
        document.getElementById('currentPwd').value = '';
        document.getElementById('newPwd').value = '';
        document.getElementById('confirmPwd').value = '';
        this.toast('Password updated successfully', 'success');
      }).catch(err => {
        this.toast('Error updating password: ' + err.message, 'error');
      });
    }).catch(err => {
      this.toast('Current password is incorrect', 'error');
    });
  },

  clearAllData() {
    if (confirm('Are you sure? This will delete ALL events and bookings permanently.')) {
      
      const batch = db.batch();
      this.events.forEach(e => batch.delete(db.collection('events').doc(e.id)));
      this.bookings.forEach(b => batch.delete(db.collection('bookings').doc(b.id)));
      this.waitlists.forEach(w => batch.delete(db.collection('waitlists').doc(w.id)));
      
      batch.commit().then(() => {
        this.toast('All data has been cleared', 'info');
      });
    }
  },

  // ===================== MOBILE NAV =====================
  toggleMobileNav() {
    const drop = document.getElementById('mobileNavDrop');
    const btn = document.getElementById('mobileNavBtn');
    drop.classList.toggle('hidden');
    btn.innerHTML = drop.classList.contains('hidden') ? '<i class="fas fa-bars"></i>' : '<i class="fas fa-xmark"></i>';
  },

  closeMobileNav() {
    const drop = document.getElementById('mobileNavDrop');
    const btn = document.getElementById('mobileNavBtn');
    drop.classList.add('hidden');
    btn.innerHTML = '<i class="fas fa-bars"></i>';
  },

  // ===================== UTILITIES =====================
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
};

// Global scroll helper (used by inline onclick handlers in HTML)
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => App.init());
