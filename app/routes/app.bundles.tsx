import { useState, useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";

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
      discountCodes: bundle.discountCodes || []
    }));

    return { bundles: formattedBundles };
  } catch (err: any) {
    console.error("Bundles loader error:", err);
    return { bundles: [] };
  }
};

export default function BundlesRoute() {
  const loaderData = useLoaderData() as { bundles: Bundle[] };
  const bundles = loaderData.bundles;
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const [toasts, setToasts] = useState<{ id: string; message: string; variant: 'success' | 'error' | 'info' }[]>([]);
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
        } catch (e) { }
      }
    } catch (e) { }

    const id = String(Date.now()) + Math.random().toString(36).slice(2, 7);
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  };

  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingRules, setEditingRules] = useState<BundleRule[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name?: string } | null>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [bundleName, setBundleName] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  // Fetch collections and check authentication
  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 410) {
          window.location.href = "/app";
          return;
        }
        throw new Error("Failed to fetch collections");
      }

      const data = await response.json();
      setCollections(data);
    } catch (err: any) {
      console.error("Error fetching collections:", err);
      setError("Failed to load collections. Please try again later.");
    } finally {
      setLoading(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const validateRule = (rule: any) => {
    const tier = String(rule?.tier || "").trim();
    const totalProducts = Number(rule?.totalProducts || 0);
    const discountPercentage = Number(rule?.discountPercentage || 0);

    if (!tier) return "Discount Name is required";
    if (!Number.isFinite(totalProducts) || totalProducts <= 0)
      return "Total Products must be greater than 0";
    if (!Number.isFinite(discountPercentage) || discountPercentage <= 0)
      return "Discount Percentage must be greater than 0";

    return null;
  };

  const isBundleNameDuplicate = (name: string, excludeBundleId?: string) => {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) return false;

    return bundles.some((b) => {
      if (excludeBundleId && b.id === excludeBundleId) return false;
      return String(b.name || "").trim().toLowerCase() === normalized;
    });
  };

  const validateCreateBundle = () => {
    if (!selectedCollection) return "Please select a collection.";
    if (!bundleName.trim()) return "Bundle name is required.";

    if (isBundleNameDuplicate(bundleName)) {
      return "Bundle name already exists. Please use a unique name.";
    }

    const rules = selectedCollection?.rules || [];
    if (!rules.length) return "Please add at least one rule.";

    for (let i = 0; i < rules.length; i++) {
      const err = validateRule(rules[i]);
      if (err) return `Rule ${i + 1}: ${err}`;
    }

    return null;
  };

  const validateUpdateBundle = (bundleId: string, name: string, rules: BundleRule[]) => {
    if (!String(name || "").trim()) return "Bundle name is required.";

    if (isBundleNameDuplicate(name, bundleId)) {
      return "Bundle name already exists. Please use a unique name.";
    }

    if (!rules?.length) return "At least one rule is required.";

    for (let i = 0; i < rules.length; i++) {
      const err = validateRule(rules[i]);
      if (err) return `Rule ${i + 1}: ${err}`;
    }

    return null;
  };

  if (isInitializing) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: '#fff',
          padding: '40px',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '6px solid #e2e8f0',
            borderTop: '6px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a202c',
            margin: '0 0 10px 0'
          }}>
            Loading Bundles...
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#718096',
            margin: 0
          }}>
            Please wait while we load your bundle data
          </p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const handleCreateBundle = async () => {
    const validationError = validateCreateBundle();
    if (validationError) {
      setError(validationError);
      showToast(validationError, "error");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bundles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          intent: "create",
          name: bundleName.trim(),
          collectionId: selectedCollection.id,
          collectionTitle: selectedCollection.title,
          rules: selectedCollection.rules.map((rule: any) => ({
            ...rule,
            tier: String(rule.tier || "").trim(),
            totalProducts: Number(rule.totalProducts || 0),
            discountPercentage: Number(rule.discountPercentage || 0),
            id: rule.id || Date.now().toString() + Math.random().toString(36).substring(7),
            discountCode: null,
            isActive: false,
            shopifyPriceRuleId: null,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Failed to create bundle");
      }

      revalidator.revalidate();
      showToast(result.message || "Bundle created successfully!", "success");
      setBundleName("");
      setSelectedCollection(null);
    } catch (err: any) {
      console.error("Error creating bundle:", err);
      const msg = err.message || "Failed to create bundle. Please try again later.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };


  const handleAddRule = () => {
    const newRule = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      tier: "",
      totalProducts: 0,
      discountPercentage: 0,
      discountCode: null,
      isActive: false,
      shopifyPriceRuleId: null
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

  const handleRuleChange = (index: number, field: string, value: any) => {
    const updatedRules = [...selectedCollection.rules];
    updatedRules[index][field] = value;
    setSelectedCollection({
      ...selectedCollection,
      rules: updatedRules,
    });
  };

  // Create discount code for a rule
  const handleCreateDiscountCode = async (bundleId: string, ruleIndex: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bundles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          intent: "create-discount",
          bundleId: bundleId,
          ruleIndex: ruleIndex
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Failed to create discount");
      }

      console.log("Discount created successfully:", result);
      revalidator.revalidate();
      showToast(result.message || "Discount code created successfully!", "success");
    } catch (err: any) {
      console.error("Error creating discount:", err);
      setError(err.message || "Failed to create discount code. Please try again later.");
      showToast(err.message || "Failed to create discount", "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete bundle
  const handleDeleteBundle = async (bundleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bundles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          intent: "delete",
          bundleId: bundleId
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Failed to delete bundle");
      }

      console.log("Bundle deleted successfully:", result);
      revalidator.revalidate();
      showToast(result.message || "Bundle deleted successfully!", "success");
      setConfirmDelete(null);
    } catch (err: any) {
      console.error("Error deleting bundle:", err);
      setError(err.message || "Failed to delete bundle. Please try again later.");
      showToast(err.message || "Failed to delete bundle", "error");
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  // Update bundle
  const handleUpdateBundle = async (bundleId: string, name: string, rules: BundleRule[]) => {
    // FIXED: Pass parameters in correct order
    const validationError = validateUpdateBundle(bundleId, name, rules);
    if (validationError) {
      setError(validationError);
      showToast(validationError, "error");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          intent: "update",
          bundleId,
          name: name.trim(),
          rules: rules.map((r: any) => ({
            ...r,
            tier: String(r.tier || "").trim(),
            totalProducts: Number(r.totalProducts || 0),
            discountPercentage: Number(r.discountPercentage || 0),
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Failed to update bundle");
      }

      setEditingBundleId(null);
      setEditingName("");
      setEditingRules([]);
      revalidator.revalidate();
      showToast(result.message || "Bundle updated successfully!", "success");
    } catch (err: any) {
      console.error("Save bundle edit error", err);
      const msg = err.message || "Failed to save changes";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // Add rule when editing
  const handleAddEditingRule = () => {
    const newRule: BundleRule = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      tier: "",
      totalProducts: 0,
      discountPercentage: 0,
      discountCode: null,
      isActive: false,
      shopifyPriceRuleId: null
    };
    setEditingRules([...editingRules, newRule]);
  };

  // Delete rule when editing
  const handleDeleteEditingRule = (index: number) => {
    const updatedRules = [...editingRules];
    updatedRules.splice(index, 1);
    setEditingRules(updatedRules);
  };

  return (
    <div className="page-container" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div className="content-wrapper" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div className="page-header" style={{ textAlign: 'center', marginBottom: '48px' }}>
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
            Create custom product bundles with custom discounts to boost your sales!
          </p>
        </div>

        {/* Main Content Card */}
        <div className="main-card" style={{
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
                        width: '90%',
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
                  className="add-rule-btn"
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

              <div className="rules-list" style={{ display: 'grid', gap: '16px' }}>
                {selectedCollection.rules?.map((rule: any, index: number) => (
                  <div
                    key={rule.id}
                    className="rule-form-card"
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
                        const updatedRules = selectedCollection.rules.filter((r: any) => r.id !== rule.id);
                        setSelectedCollection({ ...selectedCollection, rules: updatedRules });
                      }}
                      className="remove-rule-btn"
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

                    <div className="rule-fields-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingRight: '40px' }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#4a5568',
                          marginBottom: '8px'
                        }}>
                          Discount Name
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
        <div className="bundles-list-card" style={{
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
            <div className="bundles-grid" style={{ display: 'grid', gap: '20px' }}>
              {bundles.map((bundle) => (
                <div
                  key={bundle.id}
                  className="bundle-item-card"
                  style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '24px',
                    background: '#fafafa',
                    transition: 'all 0.2s'
                  }}
                >
                  <div className="bundle-info" style={{ marginBottom: '20px' }}>
                    <h3 style={{
                      fontSize: '20px',
                      fontWeight: '600',
                      color: '#1a202c',
                      margin: '0 0 8px 0'
                    }}>
                      {bundle.name}
                    </h3>
                    <div className="bundle-meta" style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '14px',
                      color: '#718096'
                    }}>
                      <span>📁 {bundle.collectionTitle}</span>
                      <span>📅 {new Date(bundle.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="bundle-rules-section" style={{
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
                    <div className="bundle-rules-display-grid" style={{ display: 'grid', gap: '12px' }}>
                      {bundle.rules.map((rule, index) => (
                        <div
                          key={index}
                          className="bundle-rule-row"
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
                          {/* <div>
                            <div style={{ color: '#718096', fontSize: '12px', marginBottom: '4px' }}>Status</div>
                            <div style={{
                              fontWeight: '600',
                              color: rule.discountCode ? '#667eea' : '#718096',
                              fontFamily: rule.discountCode ? 'monospace' : 'inherit'
                            }}>
                              {rule.discountCode || 'No discount'}
                            </div>
                          </div> */}
                        </div>
                      ))}
                    </div>
                  </div>

                  {editingBundleId === bundle.id ? (
                    <div className="editing-container" style={{
                      background: '#fff',
                      borderRadius: '12px',
                      padding: '24px',
                      marginBottom: '16px',
                      border: '2px solid #667eea'
                    }}>
                      <div className="edit-field" style={{ marginBottom: '20px' }}>
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
                          className="edit-input"
                          onChange={(e) => setEditingName(e.target.value)}
                          style={{
                            width: '90%',
                            padding: '12px 14px',
                            fontSize: '15px',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px'
                          }}
                        />
                      </div>

                      <div className="edit-rules-list" style={{ display: 'grid', gap: '16px' }}>
                        {editingRules.map((rule, idx) => (
                          <div
                            key={rule.id}
                            className="edit-rule-item"
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
                              onClick={() => handleDeleteEditingRule(idx)}
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
                                Discount Name
                              </label>
                              <input
                                type="text"
                                value={rule.tier || ""}
                                onChange={(e) => {
                                  const updated = [...editingRules];
                                  const tier = e.target.value;
                                  updated[idx].tier = tier;
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
                          </div>
                        ))}

                        <button
                          onClick={handleAddEditingRule}
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
                          onClick={() => handleUpdateBundle(bundle.id, editingName, editingRules)}
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
                          setEditingRules(bundle.rules.map(rule => ({ ...rule, id: rule.id || Date.now().toString() + Math.random().toString(36).substring(7) })));
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
          className="modal-overlay"
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
          <div className="modal-content" style={{
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
            <div className="modal-actions" style={{
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
                onClick={() => handleDeleteBundle(confirmDelete.id)}
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
        className="toast-container"
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 9999,
          width: '360px'
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-item"
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

      {/* Animation Keyframes and Responsive Styles */}
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

        /* Responsive Overrides */
        @media (max-width: 768px) {
          .page-container {
            padding: 20px 12px !important;
          }
          .page-header h1 {
            font-size: 28px !important;
          }
          .page-header p {
            font-size: 15px !important;
          }
          .main-card, .bundles-list-card {
            padding: 20px !important;
          }
          .rule-fields-grid, .edit-rule-item {
            grid-template-columns: 1fr !important;
            padding-right: 0 !important;
          }
          .rule-fields-grid > div {
             width: 100% !important;
          }
          .rule-fields-grid input, .edit-rule-item input {
            width: 100% !important;
          }
          .bundle-rule-row {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .modal-content {
            width: 90% !important;
            padding: 24px !important;
          }
          .toast-container {
            width: calc(100% - 48px) !important;
            right: 24px !important;
            left: 24px !important;
          }
          .bundle-meta {
            flex-direction: column !important;
            gap: 4px !important;
          }
          .add-rule-btn {
            width: 100% !important;
            margin-top: 10px !important;
          }
          .page-header {
            margin-bottom: 24px !important;
          }
          .remove-rule-btn {
             top: 8px !important;
             right: 8px !important;
          }
        }

        @media (max-width: 480px) {
          .bundle-rule-row {
            grid-template-columns: 1fr !important;
          }
          .modal-actions {
            flex-direction: column !important;
          }
          .page-header h1 {
            font-size: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}

import { useRouteError } from "react-router";


