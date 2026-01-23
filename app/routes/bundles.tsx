import { useState, useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { Bundle, BundleRule } from "../../types/Bundle";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);

    const bundles = await prisma.bundle.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formattedBundles: Bundle[] = bundles.map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      collectionId: bundle.collectionId,
      collectionTitle: bundle.collectionTitle,
      createdAt: bundle.createdAt.toISOString(),
      updatedAt: bundle.updatedAt.toISOString(),
      rules: bundle.rules ? (JSON.parse(bundle.rules) as BundleRule[]) : [],
    }));

    return formattedBundles;
  } catch (err: any) {
    console.error("Bundles loader error:", err);
    return [];
  }
};

export default function BundlesRoute() {
  const bundles = useLoaderData() as Bundle[];
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const showToast = (message: string, variant: 'success' | 'error' | 'info' = 'info', duration = 5000) => {
    try {
      const globalApp = (window as any)?.appBridge;
      if (globalApp && globalApp.dispatch) {
        try {
          const tb = (globalApp as any).Toast || null;
          if (tb && tb.create) {
            tb.create(globalApp, { message, duration }).dispatch(tb.Action.SHOW);
            return;
          }
        } catch (e) {}
      }
    } catch (e) {}

    const id = String(Date.now()) + Math.random().toString(36).slice(2, 7);
    setToasts((t) => [...t, { id, message, variant } as any]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  };

  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingRules, setEditingRules] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name?: string } | null>(null);
  const [showCollections, setShowCollections] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [bundleName, setBundleName] = useState("");

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch collections");
      }

      const data = await response.json();
      setCollections(data);
    } catch (err: any) {
      console.error("Error fetching collections:", err);
      setError("Failed to load collections. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreateBundle = async () => {
    if (!selectedCollection) {
      setError("Please select a collection.");
      return;
    }

    if (!bundleName.trim()) {
      setError("Please provide a valid bundle name.");
      return;
    }

    if (!selectedCollection.rules || selectedCollection.rules.length === 0) {
      setError("Please add at least one rule.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bundles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "create",
          name: bundleName,
          collectionId: selectedCollection.id,
          collectionTitle: selectedCollection.title,
          rules: selectedCollection.rules,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create bundle");
      }

      const result = await response.json();
      console.log("Bundle created successfully:", result);
      revalidator.revalidate();
      showToast("Bundle created successfully!", "success");
      setBundleName("");
      setSelectedCollection(null);
    } catch (err: any) {
      console.error("Error creating bundle:", err);
      setError(err.message || "Failed to create bundle. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    const newRule = {
      id: Date.now().toString(),
      tier: "",
      totalProducts: 0,
      discountPercentage: 0,
      discountCode: "",
    };

    setSelectedCollection({
      ...selectedCollection,
      rules: [...(selectedCollection.rules || []), newRule],
    });
  };

  const clampNumber = (value: number) => (Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value)));

  const handleSelectedRuleQtyChange = (index: number, qty: number) => {
    const updatedRules = [...(selectedCollection.rules || [])];
    const clamped = clampNumber(qty);
    updatedRules[index].totalProducts = clamped;
    setSelectedCollection({ ...selectedCollection, rules: updatedRules });
  };

  const handleSelectedRuleQtyInc = (index: number, delta: number) => {
    const current = Number(selectedCollection.rules[index].totalProducts || 0);
    handleSelectedRuleQtyChange(index, current + delta);
  };

  const handleEditingRuleQtyChange = (index: number, qty: number) => {
    const updated = [...editingRules];
    updated[index].totalProducts = clampNumber(qty);
    setEditingRules(updated);
  };

  const handleEditingRuleQtyInc = (index: number, delta: number) => {
    const current = Number(editingRules[index].totalProducts || 0);
    handleEditingRuleQtyChange(index, current + delta);
  };

  const generateDiscountCode = (tier: string) => {
    if (!tier?.trim()) return "";
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${tier.toUpperCase()}-${random}`;
  };

  const handleRuleChange = (index: number, field: string, value: any) => {
    const updatedRules = [...selectedCollection.rules];
    updatedRules[index][field] = value;

    if (field === "tier") {
      updatedRules[index].discountCode = generateDiscountCode(value);
    }

    setSelectedCollection({
      ...selectedCollection,
      rules: updatedRules,
    });
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ 
            fontSize: '42px', 
            fontWeight: '700', 
            color: '#fff', 
            margin: '0 0 12px 0',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            Bundle Builder
          </h1>
          <p style={{ 
            fontSize: '18px', 
            color: 'rgba(255,255,255,0.9)', 
            margin: 0 
          }}>
            Create powerful product bundles with custom discount tiers
          </p>
        </div>

        {/* Main Content Card */}
        <div style={{ 
          background: '#fff', 
          borderRadius: '16px', 
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          padding: '40px',
          marginBottom: '32px'
        }}>
          {error && (
            <div style={{ 
              padding: '16px 20px', 
              background: '#fee', 
              border: '1px solid #fcc',
              borderRadius: '12px', 
              color: '#c33', 
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Collection Selection */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1a202c',
              marginBottom: '12px'
            }}>
              Select Collection
            </label>
            {loading ? (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: '#718096' 
              }}>
                <div style={{ 
                  display: 'inline-block',
                  width: '40px',
                  height: '40px',
                  border: '4px solid #e2e8f0',
                  borderTop: '4px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ marginTop: '16px', fontSize: '14px' }}>Loading collections...</p>
              </div>
            ) : (
              <div>
                <select
                  value={selectedCollection?.id || ""}
                  onChange={(e) => {
                    const collection = collections.find((col) => col.id === e.target.value);
                    setSelectedCollection(collection);
                  }}
                  style={{ 
                    width: '100%', 
                    padding: '14px 16px', 
                    fontSize: '15px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    background: '#fff'
                  }}
                >
                  <option value="">Choose a collection...</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title}
                    </option>
                  ))}
                </select>

                {selectedCollection && (
                  <div style={{ marginTop: '20px' }}>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1a202c',
                      marginBottom: '12px'
                    }}>
                      Bundle Name
                    </label>
                    <input
                      type="text"
                      value={bundleName}
                      onChange={(e) => setBundleName(e.target.value)}
                      placeholder="e.g., Summer Collection Bundle"
                      style={{ 
                        width: '100%', 
                        padding: '14px 16px', 
                        fontSize: '15px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '10px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rules Section */}
          {selectedCollection && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <div>
                  <h2 style={{ 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    color: '#1a202c',
                    margin: '0 0 4px 0'
                  }}>
                    Discount Rules
                  </h2>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#718096', 
                    margin: 0 
                  }}>
                    for {selectedCollection.title}
                  </p>
                </div>
                <button
                  onClick={handleAddRule}
                  style={{ 
                    padding: '12px 24px', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                    transition: 'all 0.2s'
                  }}
                >
                  + Add Rule
                </button>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {selectedCollection.rules?.map((rule, index) => (
                  <div 
                    key={rule.id} 
                    style={{ 
                      padding: '24px', 
                      border: '2px solid #e2e8f0',
                      borderRadius: '12px',
                      background: '#fafafa',
                      position: 'relative',
                      transition: 'all 0.2s'
                    }}
                  >
                    <button
                      onClick={() => {
                        const updatedRules = selectedCollection.rules.filter((r) => r.id !== rule.id);
                        setSelectedCollection({ ...selectedCollection, rules: updatedRules });
                      }}
                      style={{ 
                        position: 'absolute', 
                        top: '16px', 
                        right: '16px',
                        width: '32px',
                        height: '32px',
                        background: '#fff',
                        border: '1px solid #fc8181',
                        borderRadius: '8px',
                        color: '#e53e3e',
                        fontSize: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      ✕
                    </button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingRight: '40px' }}>
                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '13px', 
                          fontWeight: '600',
                          color: '#4a5568',
                          marginBottom: '8px'
                        }}>
                          Tier Name
                        </label>
                        <input
                          type="text"
                          value={rule.tier || ""}
                          onChange={(e) => handleRuleChange(index, "tier", e.target.value)}
                          placeholder="e.g., Silver, Gold, Platinum"
                          style={{
                            width: 'calc(100% - 28px)',
                            padding: '12px 14px',
                            fontSize: '15px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            outline: 'none',
                            background: '#fff',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '13px', 
                          fontWeight: '600',
                          color: '#4a5568',
                          marginBottom: '8px'
                        }}>
                          Total Products
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button 
                            onClick={() => handleSelectedRuleQtyInc(index, -1)} 
                            style={{ 
                              width: '40px', 
                              height: '46px',
                              background: '#fff',
                              border: '2px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '18px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              flexShrink: 0
                            }}
                          >
                            −
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={String(rule.totalProducts ?? '')}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9]/g, '');
                              handleSelectedRuleQtyChange(index, v === '' ? 0 : Number(v));
                            }}
                            style={{ 
                              flex: 1,
                              minWidth: 0,
                              padding: '12px',
                              fontSize: '15px',
                              border: '2px solid #e2e8f0',
                              borderRadius: '8px',
                              textAlign: 'center',
                              background: '#fff',
                              boxSizing: 'border-box'
                            }}
                          />
                          <button 
                            onClick={() => handleSelectedRuleQtyInc(index, 1)} 
                            style={{ 
                              width: '40px', 
                              height: '46px',
                              background: '#fff',
                              border: '2px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '18px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              flexShrink: 0
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '13px', 
                          fontWeight: '600',
                          color: '#4a5568',
                          marginBottom: '8px'
                        }}>
                          Discount Percentage
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={String(rule.discountPercentage ?? '')}
                          onChange={(e) => handleRuleChange(index, 'discountPercentage', Number(e.target.value.replace(/[^0-9]/g, '') || 0))}
                          placeholder="0"
                          style={{ 
                            width: 'calc(100% - 28px)',
                            padding: '12px 14px',
                            fontSize: '15px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            background: '#fff',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '13px', 
                          fontWeight: '600',
                          color: '#4a5568',
                          marginBottom: '8px'
                        }}>
                          Discount Code
                        </label>
                        <input
                          type="text"
                          value={rule.discountCode}
                          readOnly
                          style={{ 
                            width: 'calc(100% - 28px)',
                            padding: '12px 14px',
                            fontSize: '15px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            background: '#f7fafc',
                            color: '#718096',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create Button */}
          {selectedCollection && (
            <button
              onClick={handleCreateBundle}
              disabled={loading}
              style={{ 
                width: '100%',
                padding: '16px',
                background: loading ? '#cbd5e0' : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(72, 187, 120, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Creating Bundle...' : '✓ Create Bundle'}
            </button>
          )}
        </div>

        {/* Bundles List */}
        <div style={{ 
          background: '#fff', 
          borderRadius: '16px', 
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          padding: '40px'
        }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1a202c',
            margin: '0 0 24px 0'
          }}>
            Your Bundles
          </h2>

          {bundles.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: '#718096'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
              <p style={{ fontSize: '16px', margin: 0 }}>No bundles created yet. Start building your first bundle!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {bundles.map((bundle) => (
                <div 
                  key={bundle.id} 
                  style={{ 
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '24px',
                    background: '#fafafa',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ 
                      fontSize: '20px', 
                      fontWeight: '600', 
                      color: '#1a202c',
                      margin: '0 0 8px 0'
                    }}>
                      {bundle.name}
                    </h3>
                    <div style={{ 
                      display: 'flex', 
                      gap: '16px',
                      fontSize: '14px',
                      color: '#718096'
                    }}>
                      <span>📁 {bundle.collectionTitle}</span>
                      <span>📅 {new Date(bundle.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ 
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '600',
                      color: '#4a5568',
                      marginBottom: '12px'
                    }}>
                      Discount Rules
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {bundle.rules.map((rule, index) => (
                        <div 
                          key={index}
                          style={{ 
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '12px',
                            padding: '12px',
                            background: '#f7fafc',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}
                        >
                          <div>
                            <div style={{ color: '#718096', fontSize: '12px', marginBottom: '4px' }}>Tier</div>
                            <div style={{ fontWeight: '600', color: '#1a202c' }}>{rule.tier}</div>
                          </div>
                          <div>
                            <div style={{ color: '#718096', fontSize: '12px', marginBottom: '4px' }}>Products</div>
                            <div style={{ fontWeight: '600', color: '#1a202c' }}>{rule.totalProducts}</div>
                          </div>
                          <div>
                            <div style={{ color: '#718096', fontSize: '12px', marginBottom: '4px' }}>Discount</div>
                            <div style={{ fontWeight: '600', color: '#48bb78' }}>{rule.discountPercentage}%</div>
                          </div>
                          <div>
                            <div style={{ color: '#718096', fontSize: '12px', marginBottom: '4px' }}>Code</div>
                            <div style={{ 
                              fontWeight: '600', 
                              color: '#667eea',
                              fontFamily: 'monospace'
                            }}>
                              {rule.discountCode}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {editingBundleId === bundle.id ? (
                    <div style={{ 
                      background: '#fff',
                      borderRadius: '12px',
                      padding: '24px',
                      marginBottom: '16px',
                      border: '2px solid #667eea'
                    }}>
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ 
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#4a5568',
                          marginBottom: '8px'
                        }}>
                          Bundle Name
                        </label>
                        <input 
                          value={editingName} 
                          onChange={(e) => setEditingName(e.target.value)} 
                          style={{ 
                            width: '100%',
                            padding: '12px 14px',
                            fontSize: '15px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px'
                          }} 
                        />
                      </div>

                      <div style={{ display: 'grid', gap: '16px' }}>
                        {editingRules.map((rule, idx) => (
                          <div 
                            key={rule.id} 
                            style={{ 
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: '16px',
                              padding: '16px',
                              paddingRight: '48px',
                              background: '#f7fafc',
                              borderRadius: '8px',
                              position: 'relative'
                            }}
                          >
                            <button 
                              onClick={() => setEditingRules((r) => r.filter((x) => x.id !== rule.id))}
                              style={{ 
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                width: '28px',
                                height: '28px',
                                background: '#fff',
                                border: '1px solid #fc8181',
                                borderRadius: '6px',
                                color: '#e53e3e',
                                fontSize: '14px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>

                            <div>
                              <label style={{ 
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#4a5568',
                                marginBottom: '6px'
                              }}>
                                Tier Name
                              </label>
                              <input
                                type="text"
                                value={rule.tier || ""}
                                onChange={(e) => {
                                  const updated = [...editingRules];
                                  const tier = e.target.value;
                                  updated[idx].tier = tier;
                                  updated[idx].discountCode = generateDiscountCode(tier);
                                  setEditingRules(updated);
                                }}
                                style={{ 
                                  width: 'calc(100% - 28px)',
                                  padding: '10px 12px',
                                  fontSize: '14px',
                                  border: '2px solid #e2e8f0',
                                  borderRadius: '6px',
                                  background: '#fff',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ 
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#4a5568',
                                marginBottom: '6px'
                              }}>
                                Total Products
                              </label>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button 
                                  onClick={() => handleEditingRuleQtyInc(idx, -1)} 
                                  style={{ 
                                    width: '36px',
                                    height: '42px',
                                    background: '#fff',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                >
                                  −
                                </button>
                                <input 
                                  type="text" 
                                  inputMode="numeric" 
                                  pattern="[0-9]*" 
                                  value={String(rule.totalProducts ?? '')} 
                                  onChange={(e) => { 
                                    const v = e.target.value.replace(/[^0-9]/g, ''); 
                                    handleEditingRuleQtyChange(idx, v === '' ? 0 : Number(v)); 
                                  }} 
                                  style={{ 
                                    flex: 1,
                                    minWidth: 0,
                                    padding: '10px',
                                    fontSize: '14px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    textAlign: 'center',
                                    background: '#fff',
                                    boxSizing: 'border-box'
                                  }} 
                                />
                                <button 
                                  onClick={() => handleEditingRuleQtyInc(idx, 1)} 
                                  style={{ 
                                    width: '36px',
                                    height: '42px',
                                    background: '#fff',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div>
                              <label style={{ 
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#4a5568',
                                marginBottom: '6px'
                              }}>
                                Discount %
                              </label>
                              <input 
                                type="text" 
                                inputMode="numeric" 
                                pattern="[0-9]*" 
                                value={String(rule.discountPercentage ?? '')} 
                                onChange={(e) => { 
                                  const updated = [...editingRules]; 
                                  const v = Number(e.target.value.replace(/[^0-9]/g, '') || 0); 
                                  updated[idx].discountPercentage = v; 
                                  setEditingRules(updated); 
                                }} 
                                style={{ 
                                  width: 'calc(100% - 28px)',
                                  padding: '10px 12px',
                                  fontSize: '14px',
                                  border: '2px solid #e2e8f0',
                                  borderRadius: '6px',
                                  background: '#fff',
                                  boxSizing: 'border-box'
                                }} 
                              />
                            </div>

                            <div>
                              <label style={{ 
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#4a5568',
                                marginBottom: '6px'
                              }}>
                                Discount Code
                              </label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                  type="text" 
                                  value={rule.discountCode ?? ''} 
                                  onChange={(e) => { 
                                    const updated = [...editingRules]; 
                                    updated[idx].discountCode = e.target.value; 
                                    setEditingRules(updated); 
                                  }} 
                                  style={{ 
                                    flex: 1,
                                    minWidth: 0,
                                    padding: '10px 12px',
                                    fontSize: '14px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    background: '#fff',
                                    fontFamily: 'monospace',
                                    boxSizing: 'border-box'
                                  }} 
                                />
                                <button 
                                  onClick={async () => { 
                                    try { 
                                      await navigator.clipboard.writeText(rule.discountCode || ''); 
                                      showToast('Code copied!', 'success'); 
                                    } catch (e) { 
                                      showToast('Copy failed', 'error'); 
                                    } 
                                  }} 
                                  style={{ 
                                    padding: '10px 16px',
                                    background: '#fff',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    flexShrink: 0
                                  }}
                                >
                                  📋
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button 
                          onClick={() => setEditingRules((r) => [...r, { 
                            id: Date.now().toString(), 
                            totalProducts: 0, 
                            discountPercentage: 0, 
                            discountCode: '' 
                          }])} 
                          style={{ 
                            padding: '12px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          + Add Rule
                        </button>
                      </div>

                      <div style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        marginTop: '20px',
                        justifyContent: 'flex-end'
                      }}>
                        <button
                          onClick={() => {
                            setEditingBundleId(null);
                            setEditingName('');
                            setEditingRules([]);
                          }}
                          style={{ 
                            padding: '12px 20px',
                            background: '#fff',
                            color: '#4a5568',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setLoading(true);
                            setError(null);
                            try {
                              const resName = await fetch('/api/bundles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  intent: 'update-bundle',
                                  bundleId: bundle.id,
                                  name: editingName
                                }),
                              });
                              const nameData = await resName.json();
                              if (!resName.ok) throw new Error(nameData?.error || 'Failed to update bundle name');

                              const resRules = await fetch('/api/bundles', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  intent: 'update-rules',
                                  bundleId: bundle.id,
                                  rules: editingRules
                                }),
                              });
                              const rulesData = await resRules.json();
                              if (!resRules.ok) throw new Error(rulesData?.error || 'Failed to update rules');

                              setEditingBundleId(null);
                              setEditingName('');
                              setEditingRules([]);
                              revalidator.revalidate();
                              showToast('Bundle updated successfully!', 'success');
                            } catch (err: any) {
                              console.error('Save bundle edit error', err);
                              setError(err.message || 'Failed to save changes');
                              showToast(err?.message || 'Failed to save changes', 'error');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          style={{ 
                            padding: '12px 24px',
                            background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(72, 187, 120, 0.4)'
                          }}
                        >
                          ✓ Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => {
                          setEditingBundleId(bundle.id);
                          setEditingName(bundle.name);
                          setEditingRules(bundle.rules ? JSON.parse(JSON.stringify(bundle.rules)) : []);
                        }}
                        style={{ 
                          padding: '10px 20px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ id: bundle.id, name: bundle.name })}
                        style={{ 
                          padding: '10px 20px',
                          background: '#fff',
                          color: '#e53e3e',
                          border: '2px solid #fc8181',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div 
          role="dialog" 
          aria-modal="true" 
          style={{ 
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99999,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div style={{ 
            width: '440px',
            background: '#fff',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ 
              fontSize: '40px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              ⚠️
            </div>
            <h3 style={{ 
              margin: '0 0 12px 0',
              fontSize: '22px',
              fontWeight: '600',
              textAlign: 'center',
              color: '#1a202c'
            }}>
              Delete Bundle?
            </h3>
            <p style={{ 
              color: '#718096',
              textAlign: 'center',
              fontSize: '15px',
              lineHeight: '1.6',
              margin: '0 0 24px 0'
            }}>
              Are you sure you want to delete <strong style={{ color: '#1a202c' }}>{confirmDelete.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ 
              display: 'flex',
              gap: '12px'
            }}>
              <button 
                onClick={() => setConfirmDelete(null)} 
                style={{ 
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '2px solid #e2e8f0',
                  background: '#fff',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#4a5568'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch('/api/bundles', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        intent: 'delete-bundle',
                        bundleId: confirmDelete.id
                      }),
                      credentials: 'include'
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to delete bundle');
                    showToast('Bundle deleted successfully', 'success');
                    revalidator.revalidate();
                  } catch (err: any) {
                    console.error('Delete error', err);
                    showToast(err?.message || 'Failed to delete bundle', 'error');
                  } finally {
                    setLoading(false);
                    setConfirmDelete(null);
                  }
                }} 
                style={{ 
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(229, 62, 62, 0.4)'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div 
        aria-live="polite" 
        style={{ 
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 9999,
          width: '360px'
        }}
      >
        {toasts.map((t: any) => (
          <div 
            key={t.id} 
            style={{ 
              marginBottom: '12px',
              padding: '16px 20px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              background: t.variant === 'success' ? 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)' : 
                          t.variant === 'error' ? 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)' : 
                          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <span style={{ fontSize: '20px' }}>
              {t.variant === 'success' ? '✓' : t.variant === 'error' ? '⚠' : 'ℹ'}
            </span>
            <span style={{ 
              fontSize: '15px',
              fontWeight: '500',
              flex: 1
            }}>
              {t.message}
            </span>
          </div>
        ))}
      </div>

      {/* Animation Keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        button:hover {
          transform: translateY(-2px);
        }
        button:active {
          transform: translateY(0);
        }
        input:focus, select:focus {
          border-color: #667eea !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        }
      `}</style>
    </div>
  );
}

import { useRouteError } from "react-router";

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}