import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    StyleSheet
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../services/api';

interface Notification {
    _id: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

export default function NotificationsScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/customer-portal/notifications');
            if (res.data && res.data.success) {
                setNotifications(res.data.data);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNotifications();
    }, []);

    const handleMarkAsRead = async (id: string) => {
        try {
            const res = await api.patch(`/customer-portal/notifications/${id}/read`);
            if (res.data && res.data.success) {
                setNotifications(prev =>
                    prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const res = await api.patch('/customer-portal/notifications/read-all');
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const renderItem = ({ item }: { item: Notification }) => {
        const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        return (
            <TouchableOpacity
                onPress={() => !item.isRead && handleMarkAsRead(item._id)}
                activeOpacity={0.7}
                style={[
                    styles.notificationCard,
                    !item.isRead && styles.unreadCard
                ]}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.titleContainer}>
                        {!item.isRead && <View style={styles.unreadDot} />}
                        <Text style={[styles.notificationTitle, !item.isRead && styles.unreadText]}>
                            {item.title}
                        </Text>
                    </View>
                    <Text style={styles.notificationDate}>{date}</Text>
                </View>
                <Text style={styles.notificationMessage}>{item.message}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-back" size={24} color="#f8fafc" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 ? (
                    <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 80 }} />
                )}
            </View>

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#06b6d4"
                            colors={['#06b6d4']}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="notifications-off-outline" size={60} color="#475569" />
                            <Text style={styles.emptyText}>No notifications yet</Text>
                            <Text style={styles.emptySubtext}>We'll notify you when your invoice reminders or order updates arrive.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#121212',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '700',
    },
    markAllButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
    },
    markAllText: {
        color: '#06b6d4',
        fontSize: 12,
        fontWeight: '600',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    notificationCard: {
        backgroundColor: '#121212',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#262626',
    },
    unreadCard: {
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.05)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#06b6d4',
        marginRight: 8,
    },
    notificationTitle: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    unreadText: {
        color: '#f8fafc',
        fontWeight: '700',
    },
    notificationDate: {
        color: '#64748b',
        fontSize: 11,
    },
    notificationMessage: {
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 18,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 32,
    },
    emptyText: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 16,
    },
    emptySubtext: {
        color: '#64748b',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 18,
    },
});
