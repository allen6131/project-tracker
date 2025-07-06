import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { invoicesAPI } from '../services/api';
import { Invoice } from '../types';

const InvoicesScreen: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchInvoices = async () => {
    try {
      const invoicesData = await invoicesAPI.getInvoices();
      setInvoices(invoicesData);
      setFilteredInvoices(invoicesData);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      Alert.alert('Error', 'Failed to load invoices');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    let filtered = invoices;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(invoice =>
        invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.projectName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredInvoices(filtered);
  }, [searchQuery, statusFilter, invoices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#16a34a';
      case 'unpaid': return '#dc2626';
      case 'overdue': return '#ea580c';
      case 'pending': return '#2563eb';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'unpaid': return 'Unpaid';
      case 'overdue': return 'Overdue';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const renderInvoice = ({ item }: { item: Invoice }) => (
    <TouchableOpacity style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <Text style={styles.invoiceNumber}>#{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      
      <Text style={styles.customerName}>{item.customerName}</Text>
      <Text style={styles.projectName}>{item.projectName}</Text>
      
      <View style={styles.invoiceDetails}>
        <View style={styles.detailRow}>
          <Icon name="attach-money" size={16} color="#64748b" />
          <Text style={styles.detailText}>${item.total.toLocaleString()}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Icon name="event" size={16} color="#64748b" />
          <Text style={styles.detailText}>
            Issued: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        {item.dueDate && (
          <View style={styles.detailRow}>
            <Icon name="schedule" size={16} color="#64748b" />
            <Text style={styles.detailText}>
              Due: {new Date(item.dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}
        
        {item.paidAt && (
          <View style={styles.detailRow}>
            <Icon name="check-circle" size={16} color="#16a34a" />
            <Text style={styles.detailText}>
              Paid: {new Date(item.paidAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const StatusFilter = () => (
    <View style={styles.filterContainer}>
      {['all', 'unpaid', 'pending', 'paid', 'overdue'].map(status => (
        <TouchableOpacity
          key={status}
          style={[
            styles.filterButton,
            statusFilter === status && styles.filterButtonActive
          ]}
          onPress={() => setStatusFilter(status)}
        >
          <Text style={[
            styles.filterButtonText,
            statusFilter === status && styles.filterButtonTextActive
          ]}>
            {status === 'all' ? 'All' : getStatusText(status)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="add" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search invoices..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filter */}
      <StatusFilter />

      {/* Invoices List */}
      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="receipt" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  addButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  listContainer: {
    padding: 20,
  },
  invoiceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  projectName: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  invoiceDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
});

export default InvoicesScreen; 