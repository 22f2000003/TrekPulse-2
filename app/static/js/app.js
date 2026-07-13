const { createApp, ref, reactive, onMounted, computed, watch, nextTick } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// ==========================================
// 1. DYNAMIC NAVIGATION AND SIDEBAR COMPONENTS
// ==========================================

const Sidebar = {
    template: `
        <div class="glass-sidebar d-flex flex-column justify-content-between py-4">
            <div>
                <div class="text-center px-4 mb-4">
                    <h3 class="fw-bold text-white"><i class="bi bi-compass-fill me-2 text-info"></i>TrekPulse</h3>
                    <small class="text-muted">V2 Single Page Application</small>
                </div>
                <hr class="border-secondary mx-3">
                <nav class="mt-4">
                    <template v-if="userRole === 'admin'">
                        <router-link to="/admin/dashboard" class="sidebar-link" active-class="active">
                            <i class="bi bi-grid-1x2-fill"></i>Dashboard
                        </router-link>
                        <router-link to="/profile" class="sidebar-link" active-class="active">
                            <i class="bi bi-person-fill-gear"></i>Settings
                        </router-link>
                    </template>
                    <template v-else-if="userRole === 'staff'">
                        <router-link to="/staff/dashboard" class="sidebar-link" active-class="active">
                            <i class="bi bi-briefcase-fill"></i>Assigned Treks
                        </router-link>
                        <router-link to="/profile" class="sidebar-link" active-class="active">
                            <i class="bi bi-person-bounding-box"></i>My Profile
                        </router-link>
                    </template>
                    <template v-else-if="userRole === 'trekker'">
                        <router-link to="/trekker/dashboard" class="sidebar-link" active-class="active">
                            <i class="bi bi-tree-fill"></i>Explore Routes
                        </router-link>
                        <router-link to="/profile" class="sidebar-link" active-class="active">
                            <i class="bi bi-person-circle"></i>Profile Settings
                        </router-link>
                    </template>
                </nav>
            </div>
            <div class="px-3">
                <div class="card bg-dark border-secondary p-3 mb-3 text-center" v-if="storeState.user">
                    <span class="text-white fw-bold d-block">{{ storeState.user.username }}</span>
                    <span class="badge bg-secondary mt-2 text-uppercase">{{ storeState.user.role }}</span>
                </div>
                <button @click="logout" class="btn btn-outline-danger w-100 py-2"><i class="bi bi-box-arrow-left me-2"></i>Sign Out</button>
            </div>
        </div>
    `,
    setup() {
        const storeState = window.store.state;
        const userRole = computed(() => storeState.user ? storeState.user.role : '');
        
        const logout = async () => {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                window.store.clearUser();
                window.location.hash = '/login';
            }
        };

        return { storeState, userRole, logout };
    }
};

const Header = {
    template: `
        <header class="navbar navbar-expand-lg navbar-light bg-white border-bottom py-3 px-4 mb-4 sticky-top">
            <div class="container-fluid">
                <span class="navbar-brand fw-bold text-gradient fs-4">{{ title }}</span>
                
                <div class="d-flex align-items-center">
                    <!-- Alerts / Notification Bell for Trekkers -->
                    <div class="dropdown me-4" v-if="isTrekker">
                        <button class="btn btn-light position-relative rounded-circle p-2" data-bs-toggle="dropdown" aria-expanded="false" @click="fetchNotis">
                            <i class="bi bi-bell-fill fs-5 text-secondary"></i>
                            <span v-if="unreadCount > 0" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                                {{ unreadCount }}
                            </span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end p-2 border-0 shadow" style="width: 320px; border-radius: 12px;">
                            <li class="dropdown-header fw-bold text-secondary">Notifications</li>
                            <li v-if="notifications.length === 0" class="text-center py-3 text-muted">No notifications.</li>
                            <template v-for="n in notifications.slice(0, 5)" :key="n.id">
                                <li class="p-2 border-bottom">
                                    <div class="d-flex flex-column">
                                        <p class="mb-1 small" :class="{'fw-bold': !n.is_read}">{{ n.message }}</p>
                                        <div class="d-flex justify-content-between align-items-center mt-1">
                                            <a v-if="n.type === 'csv_export'" :href="n.link" class="btn btn-sm btn-outline-success py-0 px-2" @click="markRead(n.id)"><i class="bi bi-download me-1"></i>Download</a>
                                            <button v-else-if="!n.is_read" class="btn btn-sm btn-light py-0 px-2 text-muted" @click="markRead(n.id)">Mark read</button>
                                            <small class="text-muted" style="font-size: 0.75rem;">{{ n.created_at }}</small>
                                        </div>
                                    </div>
                                </li>
                            </template>
                        </ul>
                    </div>

                    <div class="d-flex align-items-center">
                        <i class="bi bi-person-circle fs-3 text-secondary me-2"></i>
                        <span class="fw-bold">{{ username }}</span>
                    </div>
                </div>
            </div>
        </header>
    `,
    props: {
        title: { type: String, default: 'Dashboard' }
    },
    setup() {
        const storeState = window.store.state;
        const isTrekker = computed(() => storeState.user && storeState.user.role === 'trekker');
        const username = computed(() => storeState.user ? storeState.user.username : '');
        const unreadCount = computed(() => storeState.unreadNotificationsCount);
        const notifications = computed(() => storeState.notifications);

        const fetchNotis = () => {
            window.store.fetchNotifications();
        };

        const markRead = async (id) => {
            const res = await fetch(`/api/trekker/notifications/${id}/read`, { method: 'POST' });
            if (res.ok) {
                window.store.fetchNotifications();
            }
        };

        return { isTrekker, username, unreadCount, notifications, fetchNotis, markRead };
    }
};


// ==========================================
// 2. PUBLIC LANDING PAGE (PRE-LOGIN)
// ==========================================

const PublicLanding = {
    template: `
        <div class="landing-page">
            <!-- Navbar -->
            <nav class="navbar navbar-expand-lg navbar-dark py-3 px-4 shadow sticky-top" style="background-color: rgba(2, 44, 34, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.08);">
                <div class="container-fluid">
                    <router-link to="/" class="navbar-brand fw-bold fs-3 text-gradient">
                        <i class="bi bi-compass-fill me-2 text-info"></i>TrekPulse
                    </router-link>
                    <div>
                        <router-link to="/login" class="btn btn-outline-light me-2 px-4">Login</router-link>
                        <router-link to="/register" class="btn btn-success px-4" style="background-color: var(--primary); border-color: var(--primary);">Sign Up</router-link>
                    </div>
                </div>
            </nav>

            <!-- Hero Section -->
            <section class="hero-section py-5 text-white text-center d-flex align-items-center" style="background: linear-gradient(rgba(2, 44, 34, 0.75), rgba(2, 44, 34, 0.95)), url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80') no-repeat center center/cover; min-height: 50vh;">
                <div class="container">
                    <h1 class="display-3 fw-bold mb-3 mt-4 text-gradient-light">Adventure Awaits</h1>
                    <p class="lead mb-4 mx-auto" style="max-width: 600px;">
                        Discover breathtaking trails, connect with certified guides, and embark on journeys of a lifetime. Start your trekking adventure today.
                    </p>
                    <div class="d-flex justify-content-center gap-3">
                        <router-link to="/register" class="btn btn-lg btn-premium px-5 py-3 fs-5">Get Started</router-link>
                        <a href="#explore" class="btn btn-lg btn-outline-light px-5 py-3 fs-5">Explore Trails</a>
                    </div>
                </div>
            </section>

            <div class="container py-5">
                <!-- Stats Row -->
                <div class="row g-4 mb-5 text-center">
                    <div class="col-md-6 col-lg-3">
                        <div class="premium-card p-4">
                            <small class="text-muted fw-bold text-uppercase">Active Routes</small>
                            <h2 class="fw-bold mb-0 text-gradient mt-2">{{ stats.total_treks }}</h2>
                        </div>
                    </div>
                    <div class="col-md-6 col-lg-3">
                        <div class="premium-card p-4">
                            <small class="text-muted fw-bold text-uppercase">Happy Trekkers</small>
                            <h2 class="fw-bold mb-0 text-gradient mt-2">{{ stats.total_users }}</h2>
                        </div>
                    </div>
                    <div class="col-md-12 col-lg-6">
                        <div class="premium-card p-4 text-start">
                            <h6 class="fw-bold text-uppercase text-muted mb-3"><i class="bi bi-fire text-danger me-2"></i>Trending Trails</h6>
                            <div class="d-flex flex-wrap gap-2">
                                <span v-for="pt in stats.popular_treks" :key="pt.name" class="badge bg-teal-light text-success fs-6 py-2 px-3">
                                    {{ pt.name }} ({{ pt.count }} bookings)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Explore Section -->
                <section id="explore" class="mb-5">
                    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                        <div>
                            <h2 class="fw-bold text-dark"><i class="bi bi-geo-alt-fill text-success me-2"></i>Available Trails</h2>
                            <p class="text-muted mb-0">Browse through our open treks. Register to book your slot.</p>
                        </div>
                        <!-- Filters -->
                        <div class="d-flex gap-2">
                            <input type="text" v-model="searchQuery" class="form-control" placeholder="Search by name/location..." style="max-width: 250px;">
                            <select v-model="difficultyFilter" class="form-select" style="max-width: 150px;">
                                <option value="">All Difficulties</option>
                                <option value="Easy">Easy</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>

                    <!-- Loading / Empty -->
                    <div v-if="loading" class="text-center py-5">
                        <div class="spinner-border text-success" role="status"></div>
                    </div>
                    <div v-else-if="filteredTreks.length === 0" class="text-center py-5 premium-card">
                        <i class="bi bi-search fs-1 text-muted d-block mb-3"></i>
                        <h5>No treks match your criteria.</h5>
                    </div>

                    <!-- Treks Grid -->
                    <div v-else class="row g-4">
                        <div class="col-md-6 col-lg-4" v-for="t in filteredTreks" :key="t.id">
                            <div class="premium-card h-100 d-flex flex-column justify-content-between p-4">
                                <div>
                                    <div class="d-flex justify-content-between align-items-start mb-3">
                                        <span class="badge" :class="getDifficultyClass(t.difficulty)">{{ t.difficulty }}</span>
                                        <span class="text-muted small"><i class="bi bi-clock me-1"></i>{{ t.duration }} days</span>
                                    </div>
                                    <h4 class="fw-bold mb-2">{{ t.name }}</h4>
                                    <p class="text-muted mb-3"><i class="bi bi-geo-alt me-1 text-success"></i>{{ t.location }}</p>
                                    
                                    <div class="mb-3 p-3 bg-light rounded" style="border-left: 4px solid var(--primary);">
                                        <small class="d-block text-muted">Next Start Date</small>
                                        <strong class="text-dark">{{ t.start_date }}</strong>
                                    </div>
                                </div>
                                <div>
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <span class="text-muted small">Available Slots</span>
                                        <span class="fw-bold text-success">{{ t.available_slots }} slots</span>
                                    </div>
                                    <router-link to="/login" class="btn btn-outline-success w-100 py-2">
                                        <i class="bi bi-calendar-check me-2"></i>Login to Book
                                    </router-link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
            
            <!-- Footer -->
            <footer class="py-4 text-center text-muted">
                <div class="container">
                    <p class="mb-0">&copy; 2026 TrekPulse. All rights reserved. May Term Course Project.</p>
                </div>
            </footer>
        </div>
    `,
    setup() {
        const treks = ref([]);
        const stats = reactive({ total_treks: 0, total_users: 0, popular_treks: [] });
        const searchQuery = ref('');
        const difficultyFilter = ref('');
        const loading = ref(true);

        const fetchPublicData = async () => {
            try {
                const res = await fetch('/api/public/landing');
                if (res.ok) {
                    const data = await res.json();
                    treks.value = data.treks;
                    stats.total_treks = data.total_treks;
                    stats.total_users = data.total_users;
                    stats.popular_treks = data.popular_treks;
                }
            } catch (e) {
                console.error("Failed to fetch public data:", e);
            } finally {
                loading.value = false;
            }
        };

        onMounted(fetchPublicData);

        const filteredTreks = computed(() => {
            return treks.value.filter(t => {
                const matchesSearch = t.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                                      t.location.toLowerCase().includes(searchQuery.value.toLowerCase());
                const matchesDifficulty = !difficultyFilter.value || t.difficulty === difficultyFilter.value;
                return matchesSearch && matchesDifficulty;
            });
        });

        const getDifficultyClass = (diff) => {
            if (diff === 'Easy') return 'bg-success-light text-success';
            if (diff === 'Moderate') return 'bg-warning-light text-warning';
            return 'bg-danger-light text-danger';
        };

        return { stats, searchQuery, difficultyFilter, loading, filteredTreks, getDifficultyClass };
    }
};


// ==========================================
// 2. AUTHENTICATION PAGES
// ==========================================

const Login = {
    template: `
        <div class="auth-bg">
            <div class="auth-card p-5" style="max-width: 450px; width: 100%;">
                <div class="text-center mb-4">
                    <h2 class="fw-bold text-gradient"><i class="bi bi-compass-fill me-2"></i>TrekPulse Login</h2>
                    <p class="text-muted">Enter credentials to access your portal</p>
                </div>
                
                <div v-if="error" class="alert alert-danger p-2 text-center" style="border-radius: 8px;">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
                </div>
                
                <form @submit.prevent="handleLogin" novalidate>
                    <div class="mb-3">
                        <label class="form-label fw-bold">Email Address</label>
                        <input type="email" v-model="email" class="form-control py-2" :class="{'invalid-shake': errors.email}" placeholder="name@domain.com">
                    </div>
                    <div class="mb-4">
                        <label class="form-label fw-bold">Password</label>
                        <input type="password" v-model="password" class="form-control py-2" :class="{'invalid-shake': errors.password}" placeholder="******">
                    </div>
                    <button type="submit" class="btn btn-premium w-100 py-2 fs-5 mb-3" :disabled="loading">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>Sign In
                    </button>
                </form>
                
                <div class="text-center mt-3">
                    <p class="mb-0 text-muted">Don't have a Trekker account? <router-link to="/register" class="text-success fw-bold">Register here</router-link></p>
                </div>
            </div>
        </div>
    `,
    setup() {
        const email = ref('');
        const password = ref('');
        const error = ref('');
        const errors = reactive({ email: false, password: false });
        const loading = ref(false);

        const handleLogin = async () => {
            error.value = '';
            errors.email = !email.value.trim();
            errors.password = !password.value;

            if (errors.email || errors.password) {
                setTimeout(() => { errors.email = false; errors.password = false; }, 1000);
                return;
            }

            loading.value = true;
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.value, password: password.value })
                });
                const data = await res.json();
                
                if (!res.ok) {
                    error.value = data.error || 'Login failed.';
                } else {
                    window.store.setUser(data.user);
                    await window.store.fetchNotifications();
                    // Redirect based on role
                    if (data.user.role === 'admin') window.location.hash = '/admin/dashboard';
                    else if (data.user.role === 'staff') window.location.hash = '/staff/dashboard';
                    else window.location.hash = '/trekker/dashboard';
                }
            } catch (e) {
                error.value = 'Failed to connect to backend server.';
            } finally {
                loading.value = false;
            }
        };

        return { email, password, error, errors, loading, handleLogin };
    }
};

const Register = {
    template: `
        <div class="auth-bg">
            <div class="auth-card p-5" style="max-width: 480px; width: 100%;">
                <div class="text-center mb-4">
                    <h2 class="fw-bold text-gradient"><i class="bi bi-compass-fill me-2"></i>Trekker Register</h2>
                    <p class="text-muted">Sign up to explore and book amazing routes</p>
                </div>
                
                <div v-if="error" class="alert alert-danger p-2 text-center" style="border-radius: 8px;">
                    {{ error }}
                </div>
                <div v-if="success" class="alert alert-success p-2 text-center" style="border-radius: 8px;">
                    {{ success }}
                </div>
                
                <form @submit.prevent="handleRegister" novalidate>
                    <div class="mb-3">
                        <label class="form-label fw-bold">Username</label>
                        <input type="text" v-model="username" class="form-control py-2" :class="{'invalid-shake': errors.username}" placeholder="alice123">
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold">Email Address</label>
                        <input type="email" v-model="email" class="form-control py-2" :class="{'invalid-shake': errors.email}" placeholder="alice@mail.com">
                    </div>
                    <div class="mb-4">
                        <label class="form-label fw-bold">Password</label>
                        <input type="password" v-model="password" class="form-control py-2" :class="{'invalid-shake': errors.password}" placeholder="At least 6 characters">
                    </div>
                    <button type="submit" class="btn btn-premium w-100 py-2 fs-5 mb-3" :disabled="loading">
                        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>Create Account
                    </button>
                </form>
                
                <div class="text-center mt-2">
                    <p class="mb-0 text-muted">Already registered? <router-link to="/login" class="text-success fw-bold">Log in here</router-link></p>
                </div>
            </div>
        </div>
    `,
    setup() {
        const username = ref('');
        const email = ref('');
        const password = ref('');
        const error = ref('');
        const success = ref('');
        const errors = reactive({ username: false, email: false, password: false });
        const loading = ref(false);

        const handleRegister = async () => {
            error.value = '';
            success.value = '';
            errors.username = !username.value.trim() || username.value.length < 3;
            errors.email = !email.value.trim();
            errors.password = !password.value || password.value.length < 6;

            if (errors.username || errors.email || errors.password) {
                setTimeout(() => { errors.username = false; errors.email = false; errors.password = false; }, 1000);
                return;
            }

            loading.value = true;
            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username.value, email: email.value, password: password.value })
                });
                const data = await res.json();
                if (!res.ok) {
                    error.value = data.error || 'Registration failed.';
                } else {
                    success.value = data.message;
                    setTimeout(() => {
                        window.location.hash = '/login';
                    }, 2000);
                }
            } catch (e) {
                error.value = 'Database error occurred.';
            } finally {
                loading.value = false;
            }
        };

        return { username, email, password, error, success, errors, loading, handleRegister };
    }
};


// ==========================================
// 3. ADMIN PORTAL DASHBOARD
// ==========================================

const AdminDashboard = {
    template: `
        <div>
            <Sidebar />
            <div class="main-content">
                <Header title="Administrator Dashboard" />
                
                <!-- Stat Cards -->
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="premium-card p-4 d-flex align-items-center justify-content-between">
                            <div>
                                <small class="text-muted fw-bold text-uppercase">Total Treks</small>
                                <h2 class="fw-bold mb-0 text-gradient mt-2">{{ stats.total_treks }}</h2>
                            </div>
                            <div class="bg-teal p-3 rounded-circle" style="background-color: var(--primary-bg); color: var(--primary);"><i class="bi bi-map fs-3"></i></div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="premium-card p-4 d-flex align-items-center justify-content-between">
                            <div>
                                <small class="text-muted fw-bold text-uppercase">Trekkers Registered</small>
                                <h2 class="fw-bold mb-0 text-gradient mt-2">{{ stats.total_users }}</h2>
                            </div>
                            <div class="bg-teal p-3 rounded-circle" style="background-color: var(--primary-bg); color: var(--primary);"><i class="bi bi-people fs-3"></i></div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="premium-card p-4 d-flex align-items-center justify-content-between">
                            <div>
                                <small class="text-muted fw-bold text-uppercase">Total Bookings</small>
                                <h2 class="fw-bold mb-0 text-gradient mt-2">{{ stats.total_bookings }}</h2>
                            </div>
                            <div class="bg-teal p-3 rounded-circle" style="background-color: var(--primary-bg); color: var(--primary);"><i class="bi bi-journal-bookmark fs-3"></i></div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="premium-card p-4 d-flex align-items-center justify-content-between">
                            <div>
                                <small class="text-muted fw-bold text-uppercase">Active Staff</small>
                                <h2 class="fw-bold mb-0 text-gradient mt-2">{{ stats.total_staff }}</h2>
                            </div>
                            <div class="bg-teal p-3 rounded-circle" style="background-color: var(--primary-bg); color: var(--primary);"><i class="bi bi-shield-check fs-3"></i></div>
                        </div>
                    </div>
                </div>

                <!-- Charts row -->
                <div class="row g-4 mb-5">
                    <div class="col-md-6">
                        <div class="premium-card p-4">
                            <h5 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill me-2 text-success"></i>Trek Difficulty Split</h5>
                            <canvas id="difficultyChart" style="max-height: 250px;"></canvas>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="premium-card p-4">
                            <h5 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill me-2 text-success"></i>Trek Status Summary</h5>
                            <canvas id="statusChart" style="max-height: 250px;"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Core Panels tabs -->
                <div class="premium-card p-4 mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap">
                        <ul class="nav nav-pills border-0 bg-light p-1" style="border-radius: 8px;">
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 fw-bold" :class="{active: activeTab === 'treks'}" @click="activeTab = 'treks'">Treks Routes</button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 fw-bold" :class="{active: activeTab === 'staff'}" @click="activeTab = 'staff'">Guides / Staff</button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 fw-bold" :class="{active: activeTab === 'users'}" @click="activeTab = 'users'">Users List</button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link py-2 px-3 fw-bold" :class="{active: activeTab === 'bookings'}" @click="activeTab = 'bookings'">Bookings Log</button>
                            </li>
                        </ul>
                        
                        <div class="d-flex mt-2 mt-md-0">
                            <button v-if="activeTab === 'treks'" class="btn btn-premium btn-sm" @click="showTrekModal(null)"><i class="bi bi-plus-circle me-1"></i>New Trek</button>
                            <button v-if="activeTab === 'staff'" class="btn btn-premium btn-sm" @click="showStaffModal = true"><i class="bi bi-person-plus me-1"></i>Add Staff</button>
                        </div>
                    </div>

                    <!-- TREKS ROUTE GRID -->
                    <template v-if="activeTab === 'treks'">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Name</th>
                                        <th>Location</th>
                                        <th>Difficulty</th>
                                        <th>Duration</th>
                                        <th>Slots (Avail/Total)</th>
                                        <th>Assigned Guide</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="t in treks" :key="t.id">
                                        <td class="fw-bold">{{ t.name }}</td>
                                        <td>{{ t.location }}</td>
                                        <td>
                                            <span class="badge" :class="'badge-difficulty-' + t.difficulty.toLowerCase()">{{ t.difficulty }}</span>
                                        </td>
                                        <td>{{ t.duration }} Days</td>
                                        <td>
                                            <div class="d-flex align-items-center">
                                                <span class="me-2 fw-bold text-secondary">{{ t.available_slots }}/{{ t.total_slots }}</span>
                                                <div class="progress progress-slots flex-grow-1" style="max-width: 80px;">
                                                    <div class="progress-bar progress-bar-slots" :style="{width: ((t.total_slots - t.available_slots)/t.total_slots * 100) + '%'}"></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{{ t.assigned_staff_name }}</td>
                                        <td>
                                            <span class="badge" :class="{
                                                'bg-success': t.status === 'Open',
                                                'bg-warning': t.status === 'Pending' || t.status === 'Approved',
                                                'bg-secondary': t.status === 'Closed',
                                                'bg-info': t.status === 'Completed'
                                            }">{{ t.status }}</span>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm btn-outline-primary me-2" @click="showTrekModal(t)"><i class="bi bi-pencil"></i></button>
                                            <button class="btn btn-sm btn-outline-danger" @click="deleteTrek(t.id)"><i class="bi bi-trash"></i></button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </template>

                    <!-- STAFF LIST -->
                    <template v-if="activeTab === 'staff'">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Guide Name</th>
                                        <th>Email</th>
                                        <th>Contact</th>
                                        <th>Status</th>
                                        <th>Manage Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="s in staff" :key="s.id">
                                        <td class="fw-bold">{{ s.name }}</td>
                                        <td>{{ s.email }}</td>
                                        <td>{{ s.contact_details }}</td>
                                        <td>
                                            <span class="badge" :class="{
                                                'bg-success': s.status === 'approved',
                                                'bg-warning': s.status === 'pending',
                                                'bg-danger': s.status === 'blacklisted'
                                            }">{{ s.status }}</span>
                                        </td>
                                        <td>
                                            <button v-if="s.status !== 'blacklisted'" class="btn btn-sm btn-danger me-2" @click="toggleStatus(s.id, 'blacklisted')"><i class="bi bi-slash-circle me-1"></i>Deactivate</button>
                                            <button v-else class="btn btn-sm btn-success" @click="toggleStatus(s.id, 'approved')"><i class="bi bi-check-circle me-1"></i>Activate</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </template>

                    <!-- USERS / TREKKERS LIST -->
                    <template v-if="activeTab === 'users'">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Created Date</th>
                                        <th>Status</th>
                                        <th>Manage Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="u in users" :key="u.id">
                                        <td class="fw-bold">{{ u.username }}</td>
                                        <td>{{ u.email }}</td>
                                        <td>{{ u.created_at }}</td>
                                        <td>
                                            <span class="badge" :class="{
                                                'bg-success': u.status === 'approved',
                                                'bg-danger': u.status === 'blacklisted'
                                            }">{{ u.status }}</span>
                                        </td>
                                        <td>
                                            <button v-if="u.status !== 'blacklisted'" class="btn btn-sm btn-danger me-2" @click="toggleStatus(u.id, 'blacklisted')"><i class="bi bi-slash-circle me-1"></i>Blacklist</button>
                                            <button v-else class="btn btn-sm btn-success" @click="toggleStatus(u.id, 'approved')"><i class="bi bi-check-circle me-1"></i>Whitelist</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </template>

                    <!-- BOOKINGS HISTORICAL LOG -->
                    <template v-if="activeTab === 'bookings'">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th>Booking ID</th>
                                        <th>Trekker Name</th>
                                        <th>Trek Destination</th>
                                        <th>Booking Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="b in bookings" :key="b.id">
                                        <td class="fw-bold">#BK-{{ b.id }}</td>
                                        <td>{{ b.user.username }} ({{ b.user.email }})</td>
                                        <td class="fw-bold text-success">{{ b.trek.name }}</td>
                                        <td>{{ b.booking_date }}</td>
                                        <td>
                                            <span class="badge" :class="{'bg-success': b.status === 'Booked', 'bg-danger': b.status === 'Cancelled'}">{{ b.status }}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </template>
                </div>
            </div>

            <!-- TREK MODAL (CREATE / EDIT) -->
            <div v-if="showTrek" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg p-3" style="border-radius: 16px;">
                        <div class="modal-header border-0">
                            <h5 class="fw-bold text-gradient">{{ isEdit ? 'Modify Trek Route' : 'Create New Trek Route' }}</h5>
                            <button type="button" class="btn-close" @click="showTrek = false"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-12">
                                    <label class="form-label fw-bold">Trek Name</label>
                                    <input type="text" v-model="formTrek.name" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">Location</label>
                                    <input type="text" v-model="formTrek.location" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">Difficulty</label>
                                    <select v-model="formTrek.difficulty" class="form-select">
                                        <option value="Easy">Easy</option>
                                        <option value="Moderate">Moderate</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">Duration (Days)</label>
                                    <input type="number" v-model="formTrek.duration" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">Total Slots</label>
                                    <input type="number" v-model="formTrek.total_slots" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">Start Date</label>
                                    <input type="date" v-model="formTrek.start_date" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">End Date</label>
                                    <input type="date" v-model="formTrek.end_date" class="form-control">
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-bold">Assign Guide / Staff</label>
                                    <select v-model="formTrek.assigned_staff_id" class="form-select">
                                        <option :value="null">No Guide</option>
                                        <option v-for="s in staff" :key="s.id" :value="s.id">{{ s.name }}</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-bold">Initial Status</label>
                                    <select v-model="formTrek.status" class="form-select">
                                        <option value="Pending">Pending</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Open">Open</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-light" @click="showTrek = false">Cancel</button>
                            <button type="button" class="btn btn-premium" @click="submitTrek">Save Route</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- STAFF MODAL -->
            <div v-if="showStaffModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg p-3" style="border-radius: 16px;">
                        <div class="modal-header border-0">
                            <h5 class="fw-bold text-gradient">Add New Trek Guide / Staff</h5>
                            <button type="button" class="btn-close" @click="showStaffModal = false"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-12">
                                    <label class="form-label fw-bold">Full Name</label>
                                    <input type="text" v-model="formStaff.name" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">Username</label>
                                    <input type="text" v-model="formStaff.username" class="form-control">
                                </div>
                                <div class="col-6">
                                    <label class="form-label fw-bold">Email</label>
                                    <input type="email" v-model="formStaff.email" class="form-control">
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-bold">Password</label>
                                    <input type="password" v-model="formStaff.password" class="form-control">
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-bold">Contact Number</label>
                                    <input type="text" v-model="formStaff.contact_details" class="form-control">
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-light" @click="showStaffModal = false">Cancel</button>
                            <button type="button" class="btn btn-premium" @click="submitStaff">Create Staff</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    components: { Sidebar, Header },
    setup() {
        const stats = ref({});
        const treks = ref([]);
        const staff = ref([]);
        const users = ref([]);
        const bookings = ref([]);
        const activeTab = ref('treks');
        
        // Modals
        const showTrek = ref(false);
        const isEdit = ref(false);
        const formTrek = reactive({ id: null, name: '', location: '', difficulty: 'Moderate', duration: 1, total_slots: 10, start_date: '', end_date: '', assigned_staff_id: null, status: 'Open' });
        
        const showStaffModal = ref(false);
        const formStaff = reactive({ name: '', username: '', email: '', password: '', contact_details: '' });

        const loadData = async () => {
            const [sRes, tRes, stRes, uRes, bRes] = await Promise.all([
                fetch('/api/admin/stats'),
                fetch('/api/admin/treks'),
                fetch('/api/admin/staff'),
                fetch('/api/admin/users'),
                fetch('/api/admin/bookings')
            ]);
            
            if (sRes.ok) stats.value = await sRes.json();
            if (tRes.ok) treks.value = await tRes.json();
            if (stRes.ok) staff.value = await stRes.json();
            if (uRes.ok) users.value = await uRes.json();
            if (bRes.ok) bookings.value = await bRes.json();
            
            nextTick(renderCharts);
        };

        // Render Analytics Charts
        let diffChart = null;
        let statusChart = null;

        const renderCharts = () => {
            const diffCtx = document.getElementById('difficultyChart');
            const statusCtx = document.getElementById('statusChart');
            if (!diffCtx || !statusCtx) return;

            if (diffChart) diffChart.destroy();
            if (statusChart) statusChart.destroy();

            // Difficulty Split
            diffChart = new Chart(diffCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats.value.by_difficulty || {}),
                    datasets: [{
                        label: 'Treks Count',
                        data: Object.values(stats.value.by_difficulty || {}),
                        backgroundColor: ['#14b8a6', '#f59e0b', '#ef4444'],
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });

            // Status Summary
            statusChart = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(stats.value.by_status || {}),
                    datasets: [{
                        data: Object.values(stats.value.by_status || {}),
                        backgroundColor: ['#e2e8f0', '#cbd5e1', '#10b981', '#3b82f6', '#8b5cf6']
                    }]
                },
                options: { responsive: true }
            });
        };

        const showTrekModal = (trek = null) => {
            isEdit.value = !!trek;
            if (trek) {
                formTrek.id = trek.id;
                formTrek.name = trek.name;
                formTrek.location = trek.location;
                formTrek.difficulty = trek.difficulty;
                formTrek.duration = trek.duration;
                formTrek.total_slots = trek.total_slots;
                formTrek.start_date = trek.start_date;
                formTrek.end_date = trek.end_date;
                formTrek.assigned_staff_id = trek.assigned_staff_id;
                formTrek.status = trek.status;
            } else {
                Object.assign(formTrek, { id: null, name: '', location: '', difficulty: 'Moderate', duration: 3, total_slots: 20, start_date: '', end_date: '', assigned_staff_id: null, status: 'Open' });
            }
            showTrek.value = true;
        };

        const submitTrek = async () => {
            const url = isEdit.value ? `/api/admin/treks/${formTrek.id}` : '/api/admin/treks';
            const method = isEdit.value ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formTrek)
            });
            if (res.ok) {
                showTrek.value = false;
                loadData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save trek route.');
            }
        };

        const deleteTrek = async (id) => {
            if (confirm("Are you sure you want to delete this trek? This cannot be undone.")) {
                const res = await fetch(`/api/admin/treks/${id}`, { method: 'DELETE' });
                if (res.ok) loadData();
            }
        };

        const submitStaff = async () => {
            const res = await fetch('/api/admin/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formStaff)
            });
            if (res.ok) {
                showStaffModal.value = false;
                loadData();
                Object.assign(formStaff, { name: '', username: '', email: '', password: '', contact_details: '' });
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create staff account.');
            }
        };

        const toggleStatus = async (userId, status) => {
            const res = await fetch(`/api/admin/users/${userId}/toggle-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) loadData();
        };

        onMounted(loadData);

        return {
            stats, treks, staff, users, bookings, activeTab,
            showTrek, isEdit, formTrek, showTrekModal, submitTrek, deleteTrek,
            showStaffModal, formStaff, submitStaff, toggleStatus
        };
    }
};


// ==========================================
// 4. TREK STAFF GUIDES PORTAL
// ==========================================

const StaffDashboard = {
    template: `
        <div>
            <Sidebar />
            <div class="main-content">
                <Header title="Trek Staff Portal" />
                
                <h4 class="fw-bold mb-4"><i class="bi bi-calendar-event me-2 text-success"></i>Your Assigned Treks</h4>

                <div v-if="treks.length === 0" class="text-center py-5">
                    <i class="bi bi-calendar-x fs-1 text-muted"></i>
                    <p class="text-muted mt-3">You are not currently assigned to any upcoming treks.</p>
                </div>
                
                <div class="row g-4" v-else>
                    <div class="col-md-6" v-for="t in treks" :key="t.id">
                        <div class="premium-card p-4">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="fw-bold text-primary mb-0">{{ t.name }}</h5>
                                <span class="badge" :class="{
                                    'bg-success': t.status === 'Open',
                                    'bg-secondary': t.status === 'Closed',
                                    'bg-info': t.status === 'Completed'
                                }">{{ t.status }}</span>
                            </div>
                            <p class="text-muted mb-2"><i class="bi bi-geo-alt-fill me-2"></i>{{ t.location }}</p>
                            <p class="text-muted mb-3"><i class="bi bi-clock me-2"></i>{{ t.start_date }} to {{ t.end_date }} ({{ t.duration }} Days)</p>
                            
                            <div class="border-top pt-3 d-flex justify-content-between align-items-center">
                                <div>
                                    <small class="text-muted d-block">Registered Participants</small>
                                    <strong class="fs-5 text-dark">{{ t.bookings_count }} Trekkers</strong>
                                </div>
                                <div>
                                    <button class="btn btn-sm btn-outline-success me-2" @click="viewParticipants(t.id)"><i class="bi bi-people me-1"></i>List</button>
                                    <button class="btn btn-sm btn-premium" @click="manageTrek(t)"><i class="bi bi-gear me-1"></i>Update</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Manage slots/status modal -->
            <div v-if="showManage" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg p-3" style="border-radius: 16px;">
                        <div class="modal-header border-0">
                            <h5 class="fw-bold text-gradient">Update Trek Details: {{ selectedTrek.name }}</h5>
                            <button type="button" class="btn-close" @click="showManage = false"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Available Slots</label>
                                <input type="number" v-model="formManage.available_slots" class="form-control">
                                <small class="text-muted">Total capacity: {{ selectedTrek.total_slots }} slots.</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Trek status</label>
                                <select v-model="formManage.status" class="form-select">
                                    <option value="Open">Open</option>
                                    <option value="Closed">Closed</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-light" @click="showManage = false">Close</button>
                            <button type="button" class="btn btn-premium" @click="saveManage">Update Trek</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Participant List Modal -->
            <div v-if="showParticipants" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg p-3" style="border-radius: 16px;">
                        <div class="modal-header border-0">
                            <h5 class="fw-bold text-gradient">Registered Participants</h5>
                            <button type="button" class="btn-close" @click="showParticipants = false"></button>
                        </div>
                        <div class="modal-body">
                            <div v-if="participants.length === 0" class="text-center py-3">
                                <p class="text-muted">No participants booked for this trek yet.</p>
                            </div>
                            <ul class="list-group list-group-flush" v-else>
                                <li class="list-group-item d-flex justify-content-between align-items-center py-3" v-for="p in participants" :key="p.booking_id">
                                    <div>
                                        <h6 class="fw-bold mb-0 text-dark">{{ p.user.username }}</h6>
                                        <small class="text-muted">{{ p.user.email }}</small>
                                    </div>
                                    <span class="text-muted small">Booked: {{ p.booking_date.split(' ')[0] }}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    components: { Sidebar, Header },
    setup() {
        const treks = ref([]);
        const showManage = ref(false);
        const selectedTrek = ref(null);
        const formManage = reactive({ available_slots: 0, status: 'Open' });
        
        const showParticipants = ref(false);
        const participants = ref([]);

        const fetchTreks = async () => {
            const res = await fetch('/api/staff/treks');
            if (res.ok) treks.value = await res.json();
        };

        const manageTrek = (trek) => {
            selectedTrek.value = trek;
            formManage.available_slots = trek.available_slots;
            formManage.status = trek.status;
            showManage.value = true;
        };

        const saveManage = async () => {
            const res = await fetch(`/api/staff/treks/${selectedTrek.value.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formManage)
            });
            if (res.ok) {
                showManage.value = false;
                fetchTreks();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update trek.');
            }
        };

        const viewParticipants = async (trekId) => {
            const res = await fetch(`/api/staff/treks/${trekId}/participants`);
            if (res.ok) {
                participants.value = await res.json();
                showParticipants.value = true;
            }
        };

        onMounted(fetchTreks);

        return { treks, showManage, selectedTrek, formManage, manageTrek, saveManage, showParticipants, participants, viewParticipants };
    }
};


// ==========================================
// 5. TREKKER USER PORTAL
// ==========================================

const TrekkerDashboard = {
    template: `
        <div>
            <Sidebar />
            <div class="main-content">
                <Header title="Explore Trekking Adventures" />

                <!-- Search and Filters -->
                <div class="premium-card p-4 mb-4 bg-white">
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label fw-bold">Search Name/Destination</label>
                            <input type="text" v-model="filters.search" class="form-control" placeholder="Search...">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Difficulty</label>
                            <select v-model="filters.difficulty" class="form-select">
                                <option value="">All Difficulties</option>
                                <option value="Easy">Easy</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-bold">Duration (Max Days)</label>
                            <input type="number" v-model="filters.duration" class="form-control" placeholder="e.g. 7">
                        </div>
                        <div class="col-md-2 d-flex align-items-end">
                            <button @click="applyFilters" class="btn btn-premium w-100"><i class="bi bi-search me-1"></i>Search</button>
                        </div>
                    </div>
                </div>

                <!-- Trekker Panels (Explore vs Active Bookings) -->
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap">
                    <div class="btn-group p-1 bg-light" style="border-radius: 8px;">
                        <button class="btn btn-sm py-2 px-3 fw-bold" :class="[viewMode === 'explore' ? 'btn-white bg-white text-primary shadow-sm' : 'text-muted']" @click="viewMode = 'explore'">Open Routes</button>
                        <button class="btn btn-sm py-2 px-3 fw-bold" :class="[viewMode === 'bookings' ? 'btn-white bg-white text-primary shadow-sm' : 'text-muted']" @click="viewMode = 'bookings'">My Bookings</button>
                    </div>
                    
                    <button class="btn btn-sm btn-outline-success mt-2 mt-md-0 fw-bold" @click="exportHistory" :disabled="exporting">
                        <span v-if="exporting" class="spinner-border spinner-border-sm me-2"></span><i class="bi bi-file-earmark-spreadsheet-fill me-1"></i>Export History
                    </button>
                </div>

                <!-- EXPLORE TREKS VIEW -->
                <template v-if="viewMode === 'explore'">
                    <div v-if="treks.length === 0" class="text-center py-5">
                        <i class="bi bi-compass fs-1 text-muted"></i>
                        <p class="text-muted mt-3">No matching treks found. Try resetting filters.</p>
                    </div>
                    <div class="row g-4" v-else>
                        <div class="col-md-4" v-for="t in treks" :key="t.id">
                            <div class="premium-card d-flex flex-column justify-content-between p-4 h-100 bg-white">
                                <div>
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <span class="badge" :class="'badge-difficulty-' + t.difficulty.toLowerCase()">{{ t.difficulty }}</span>
                                        <span class="badge bg-light text-secondary">{{ t.duration }} Days</span>
                                    </div>
                                    <h5 class="fw-bold mb-2 text-dark">{{ t.name }}</h5>
                                    <p class="text-muted small mb-3"><i class="bi bi-geo-alt-fill me-1"></i>{{ t.location }}</p>
                                    <p class="text-muted small mb-3"><i class="bi bi-person-fill-check me-1"></i>Guide: {{ t.assigned_staff_name }}</p>
                                    
                                    <div class="mb-4">
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <span class="small text-muted">Slots Availability</span>
                                            <span class="small fw-bold text-dark">{{ t.available_slots }} / {{ t.total_slots }}</span>
                                        </div>
                                        <div class="progress progress-slots">
                                            <div class="progress-bar progress-bar-slots" :style="{width: (t.available_slots / t.total_slots * 100) + '%'}"></div>
                                        </div>
                                    </div>
                                </div>
                                <button @click="bookSlot(t.id)" class="btn btn-premium w-100 py-2 mt-auto" :disabled="t.available_slots <= 0">
                                    {{ t.available_slots > 0 ? 'Book Adventure' : 'Sold Out' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- BOOKINGS HISTORY VIEW -->
                <template v-if="viewMode === 'bookings'">
                    <div v-if="bookings.length === 0" class="text-center py-5">
                        <i class="bi bi-journal-bookmark fs-1 text-muted"></i>
                        <p class="text-muted mt-3">You have not booked any treks yet.</p>
                    </div>
                    <div class="row g-4" v-else>
                        <div class="col-md-6" v-for="b in bookings" :key="b.id">
                            <div class="premium-card p-4 bg-white">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="fw-bold mb-0 text-dark">{{ b.trek.name }}</h5>
                                    <span class="badge" :class="[b.status === 'Booked' ? 'bg-success' : 'bg-danger']">{{ b.status }}</span>
                                </div>
                                <p class="text-muted small mb-2"><i class="bi bi-geo-alt-fill me-1"></i>{{ b.trek.location }}</p>
                                <p class="text-muted small mb-3"><i class="bi bi-calendar3 me-1"></i>{{ b.trek.start_date }} to {{ b.trek.end_date }}</p>
                                <hr class="border-light">
                                <div class="d-flex justify-content-between align-items-center">
                                    <small class="text-muted">Booked on: {{ b.booking_date.split(' ')[0] }}</small>
                                    <button v-if="b.status === 'Booked'" class="btn btn-sm btn-outline-danger" @click="cancelBooking(b.id)"><i class="bi bi-x-circle me-1"></i>Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    `,
    components: { Sidebar, Header },
    setup() {
        const treks = ref([]);
        const bookings = ref([]);
        const viewMode = ref('explore');
        const filters = reactive({ search: '', difficulty: '', duration: '' });
        const exporting = ref(false);

        const fetchTreks = async () => {
            const params = new URLSearchParams(filters).toString();
            const res = await fetch(`/api/trekker/treks?${params}`);
            if (res.ok) treks.value = await res.json();
        };

        const fetchBookings = async () => {
            const res = await fetch('/api/trekker/bookings');
            if (res.ok) bookings.value = await res.json();
        };

        const applyFilters = () => {
            fetchTreks();
        };

        const bookSlot = async (trekId) => {
            const res = await fetch('/api/trekker/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trek_id: trekId })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchTreks();
                fetchBookings();
            } else {
                alert(data.error || 'Failed to book slot.');
            }
        };

        const cancelBooking = async (bookingId) => {
            if (confirm("Are you sure you want to cancel this booking?")) {
                const res = await fetch(`/api/trekker/bookings/${bookingId}/cancel`, { method: 'POST' });
                if (res.ok) {
                    fetchTreks();
                    fetchBookings();
                } else {
                    const data = await res.json();
                    alert(data.error || 'Cancellation failed.');
                }
            }
        };

        const exportHistory = async () => {
            exporting.value = true;
            try {
                const res = await fetch('/api/trekker/export', { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                    alert("Export job triggered. You will be notified in the bell alerts when it is ready.");
                    setTimeout(() => {
                        window.store.fetchNotifications();
                    }, 4000);
                } else {
                    alert(data.error || 'Failed to export history.');
                }
            } catch (e) {
                alert('Connection error during export.');
            } finally {
                exporting.value = false;
            }
        };

        onMounted(() => {
            fetchTreks();
            fetchBookings();
        });

        return { treks, bookings, viewMode, filters, applyFilters, bookSlot, cancelBooking, exportHistory, exporting };
    }
};


// ==========================================
// 6. PROFILE / SETTINGS COMPONENT
// ==========================================

const UserProfile = {
    template: `
        <div>
            <Sidebar />
            <div class="main-content">
                <Header title="My Profile Settings" />
                
                <div class="premium-card p-5 bg-white mx-auto" style="max-width: 600px;">
                    <div class="text-center mb-4">
                        <i class="bi bi-person-circle fs-1 text-primary"></i>
                        <h4 class="fw-bold mt-2">Personal Credentials</h4>
                        <p class="text-muted">Edit profile details</p>
                    </div>

                    <div v-if="success" class="alert alert-success text-center">{{ success }}</div>
                    <div v-if="error" class="alert alert-danger text-center">{{ error }}</div>

                    <form @submit.prevent="updateProfile">
                        <div class="mb-3">
                            <label class="form-label fw-bold">Username</label>
                            <input type="text" v-model="form.username" class="form-control py-2">
                        </div>
                        <div class="mb-4">
                            <label class="form-label fw-bold">Email Address</label>
                            <input type="email" v-model="form.email" class="form-control py-2">
                        </div>
                        
                        <button type="submit" class="btn btn-premium w-100 py-2"><i class="bi bi-save me-1"></i>Save Changes</button>
                    </form>
                </div>
            </div>
        </div>
    `,
    components: { Sidebar, Header },
    setup() {
        const storeState = window.store.state;
        const form = reactive({ username: '', email: '' });
        const success = ref('');
        const error = ref('');

        onMounted(() => {
            if (storeState.user) {
                form.username = storeState.user.username;
                form.email = storeState.user.email;
            }
        });

        const updateProfile = async () => {
            success.value = '';
            error.value = '';
            
            const res = await fetch('/api/trekker/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (res.ok) {
                success.value = data.message;
                window.store.setUser(data.user);
            } else {
                error.value = data.error || 'Failed to update profile.';
            }
        };

        return { form, success, error, updateProfile };
    }
};


// ==========================================
// 7. VUE ROUTER INTEGRATION
// ==========================================

const routes = [
    { path: '/', component: PublicLanding },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/admin/dashboard', component: AdminDashboard, meta: { requiresAuth: true, role: 'admin' } },
    { path: '/staff/dashboard', component: StaffDashboard, meta: { requiresAuth: true, role: 'staff' } },
    { path: '/trekker/dashboard', component: TrekkerDashboard, meta: { requiresAuth: true, role: 'trekker' } },
    { path: '/profile', component: UserProfile, meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

// Auth Route Guards
router.beforeEach(async (to, from, next) => {
    // Sync status check with session first
    if (!window.store.state.authenticated) {
        await window.store.checkAuth();
    }

    const authenticated = window.store.state.authenticated;
    const user = window.store.state.user;

    if (to.meta.requiresAuth && !authenticated) {
        next('/login');
    } else if (authenticated && (to.path === '/login' || to.path === '/register' || to.path === '/')) {
        // Redirect logged-in users to respective dashboard
        if (user.role === 'admin') next('/admin/dashboard');
        else if (user.role === 'staff') next('/staff/dashboard');
        else next('/trekker/dashboard');
    } else if (to.meta.role && user && to.meta.role !== user.role) {
        // Prevent wrong roles accessing specific dashboards
        if (user.role === 'admin') next('/admin/dashboard');
        else if (user.role === 'staff') next('/staff/dashboard');
        else next('/trekker/dashboard');
    } else {
        next();
    }
});


// ==========================================
// 8. MOUNT VUE APP
// ==========================================

const app = createApp({
    setup() {
        return {};
    }
});

app.use(router);
app.mount('#app');
