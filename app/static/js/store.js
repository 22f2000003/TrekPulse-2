// Reusable Vue 3 reactive shared store
const store = {
    state: Vue.reactive({
        user: null,
        authenticated: false,
        notifications: [],
        unreadNotificationsCount: 0
    }),
    
    setUser(user) {
        this.state.user = user;
        this.state.authenticated = !!user;
    },
    
    clearUser() {
        this.state.user = null;
        this.state.authenticated = false;
        this.state.notifications = [];
        this.state.unreadNotificationsCount = 0;
    },
    
    async checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.authenticated) {
                this.setUser(data.user);
                await this.fetchNotifications();
            } else {
                this.clearUser();
            }
        } catch (e) {
            console.error("Auth check failed:", e);
        }
    },
    
    async fetchNotifications() {
        if (!this.state.authenticated) return;
        
        // Notifications are relevant for trekkers (and optionally admin/staff alerts)
        try {
            // Trekkers have notifications, fetch if role matches
            if (this.state.user.role === 'trekker') {
                const res = await fetch('/api/trekker/notifications');
                if (res.ok) {
                    const data = await res.json();
                    this.state.notifications = data;
                    this.state.unreadNotificationsCount = data.filter(n => !n.is_read).length;
                }
            }
        } catch (e) {
            console.error("Failed to fetch notifications:", e);
        }
    }
};

window.store = store;
