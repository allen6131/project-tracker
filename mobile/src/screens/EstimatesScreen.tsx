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
import { estimatesAPI } from '../services/api';
import { Estimate } from '../types';

const EstimatesScreen: React.FC = () => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [filteredEstimates, setFilteredEstimates] = useState<Estimate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchEstimates = async () => {
    try {
      const estimatesData = await estimatesAPI.getEstimates();
      setEstimates(estimatesData);
      setFilteredEstimates(estimatesData);
    } catch (error) {
      console.error('Error fetching estimates:', error);
      Alert.alert('Error', 'Failed to load estimates');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEstimates();
  }, []);

  useEffect(() => {
    let filtered = estimates;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(estimate => estimate.status === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(estimate =>
        estimate.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        estimate.projectName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredEstimates(filtered);
  }, [searchQuery, statusFilter, estimates]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEstimates();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ea580c';
      case 'approved': return '#16a34a';
      case 'rejected': return '#dc2626';
      case 'sent': return '#2563eb';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'sent': return 'Sent';
      default: return status;
    }
  };

  const renderEstimate = ({ item }: { item: Estimate }) => (
    <TouchableOpacity style={styles.estimateCard}>
      <View style={styles.estimateHeader}>
        <Text style={styles.estimateNumber}>#{item.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      
      <Text style={styles.customerName}>{item.customerName}</Text>
      <Text style={styles.projectName}>{item.projectName}</Text>
      
      <View style={styles.estimateDetails}>
        <View style={styles.detailRow}>
          <Icon name="attach-money" size={16} color="#64748b" />
          <Text style={styles.detailText}>${item.total.toLocaleString()}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Icon name="event" size={16} color="#64748b" />
          <Text style={styles.detailText}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        {item.expiresAt && (
          <View style={styles.detailRow}>
            <Icon name="schedule" size={16} color="#64748b" />
            <Text style={styles.detailText}>
              Expires: {new Date(item.expiresAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const StatusFilter = () => (
    <View style={styles.filterContainer}>
      {['all', 'pending', 'sent', 'approved', 'rejected'].map(status => (
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
        <Text style={styles.headerTitle}>Estimates</Text>
        <TouchableOpacity style={styles.addButton}>
          <Icon name="add" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search estimates..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filter */}
      <StatusFilter />

      {/* Estimates List */}
      <FlatList
        data={filteredEstimates}
        renderItem={renderEstimate}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="assignment" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>No estimates found</Text>
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
  estimateCard: {
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
  estimateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  estimateNumber: {
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
  estimateDetails: {
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

export default EstimatesScreen; 