import React from "react";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import {
  RLThesis,
  RLQuickModel,
  RLEvidenceBadge,
  RLCallout,
  RLSourceExcerpt,
  RLRelatedPages,
  RLStatGrid
} from "../components/RLDocBlocks.jsx";

export const architecturePages = {
  "system-at-a-glance": {
    title: "System at a Glance",
    topics: [
      { label: "Level 1: Logical Flow", href: "#level-1" },
      { label: "Level 2: Internal Architecture", href: "#level-2" },
      { label: "Level 3: Sentinel HA Deployment", href: "#level-3" },
      { label: "Service Ports & Redis Keys", href: "#ports-keys" },
      { label: "Service Boundaries & Roles", href: "#boundaries" }
    ],
    content: (
      <div>
        <RLThesis>
          यह प्लेटफ़ॉर्म तीन स्पष्ट रनटाइम सीमाओं में बँटा है: क्लाइंट-फेसिंग साइडकार प्रॉक्सी (<code>:9090</code>), स्टेटलेस सेंट्रल लिमिटर पूल (<code>:8080</code> हॉट पाथ + <code>:8082</code> एडमिन), और Redis मास्टर जहाँ सभी कोटा, ओवरराइड, सर्किट, और इडेम्पोटेंसी स्टेट Lua स्क्रिप्ट्स के ज़रिए अटॉमिक रूप से सीरियलाइज़ होती है।
        </RLThesis>

        <RLQuickModel>
          क्लाइंट → साइडकार (<code>:9090</code>) → लिमिटर (<code>:8080</code>) → Redis (<code>:6379</code>) → अपस्ट्रीम (<code>:8081</code> डेमो)। कोटा निर्णय Redis में अटॉमिक हैं; साइडकार केवल डिनायल ऑफ़लोड और डुप्लिकेट सप्रेशन करता है।
        </RLQuickModel>

        <RLStatGrid stats={[
          { value: ":9090", label: "Sidecar (cmd/sidecar)", evidence: "SOURCE-PROVEN" },
          { value: ":8080", label: "Limiter hot path", evidence: "SOURCE-PROVEN" },
          { value: ":8082", label: "Admin API (isolated)", evidence: "SOURCE-PROVEN" },
          { value: ":8081", label: "Demo backend", evidence: "SOURCE-PROVEN" }
        ]} />

        <h2 className="guide-sub-heading" id="level-1">Level 1: Logical Flow</h2>
        <p>
          उच्च स्तर पर, रेट लिमिटिंग ट्रैफ़िक को अपस्ट्रीम पहुँचने से पहले समन्वित करती है। साइडकार प्रॉक्सी गेटकीपर की भूमिका निभाता है; सेंट्रल लिमिटर Redis मास्टर के विरुद्ध कोटा का मूल्यांकन करता है।
        </p>
        <DocsMermaid chart={`
flowchart LR
    Client([Client Request]) --> Sidecar[Sidecar Proxy :9090]
    Sidecar -->|"/check_hierarchical"| Limiter[Central Limiter :8080]
    Limiter -->|"EVALSHA atomic Lua"| Redis[(Redis Master :6379)]
    Sidecar -->|Forward| Upstream[Upstream :8081]
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Sidecar fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Limiter fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#18181b,stroke:#ec4899,color:#fff
    style Upstream fill:#18181b,stroke:#52525b,color:#a1a1aa
        `} />

        <h2 className="guide-sub-heading" id="level-2">Level 2: Internal Services & Infrastructure</h2>
        <p>
          अंदर की ओर, साइडकार ट्रैफ़िक इंटरसेप्ट करता है और <code>serveNormal</code> पाइपलाइन चलाता है: डिनायल कैश (केवल डिनायल) → <code>singleflight</code> → <code>checkRateLimit</code> → अपस्ट्रीम फ़ॉरवर्ड।
        </p>
        <DocsMermaid chart={`
flowchart TD
    Client([Client]) -->|Port :9090| SC["Sidecar Proxy\\n- denial_cache sync.Map\\n- singleflight.Group\\n- idempotency_store\\n- gateway_router"]
    SC -->|"/check_hierarchical"| LM["Central Limiter Pool :8080\\n- Token Bucket Engine\\n- Override Loader\\n- OTel and Prometheus metrics"]
    LM -->|"EVALSHA atomic"| Redis[("Redis Master\\nrate:* config:* cb:* idem:*")]
    SC -->|Proxy forwarding| Upstream["Upstream APIs\\n(demo-backend :8081)"]
    style Client fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SC fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Redis fill:#18181b,stroke:#ec4899,color:#fff
    style Upstream fill:#18181b,stroke:#52525b,color:#a1a1aa
        `} />

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — serveNormal"
          establishes="सत्यापित hot-path क्रम: डिनायल कैश हिट → singleflight → checkRateLimit → forward या 429।"
        >{`func (s *Sidecar) serveNormal(w http.ResponseWriter, r *http.Request, userID string) {
    cacheKey := s.cacheKey(r, userID)

    if val, ok := s.cache.Load(cacheKey); ok {
        entry := val.(CacheEntry)
        if time.Now().Before(entry.ExpiresAt) {
            if !entry.Allowed {
                s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
                return
            }
            // Allowed entries never skip the limiter
        }
    }

    resultAny, err, _ := s.limitFlight.Do(cacheKey, func() (interface{}, error) {
        return s.checkRateLimit(ctx, r, userID, false)
    })
    // ... store result, writeDenial or forwardRequest
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="level-3">Level 3: HA Sentinel Topology</h2>
        <p>
          प्रोडक्शन में, सिंगल Redis इंस्टेंस को Sentinel-समन्वित रेप्लिकेशन ग्रुप से बदला जाता है। लिमिटर रेप्लिका सक्रिय Redis मास्टर पर पढ़/लिखती हैं; Sentinel सेंट्रीज़ हेल्थ मॉनिटर और फ़ेलओवर ऑटोमेट करती हैं।
        </p>
        <DocsMermaid chart={`
flowchart TB
    SC1[Sidecar Replica 1] --> LM1[Limiter Replica 1]
    SC2[Sidecar Replica 2] --> LM2[Limiter Replica 2]
    LM1 & LM2 -->|Read/Write| Master[(Redis Master)]
    Sentinel1[Sentinel Sentry 1] & Sentinel2[Sentinel Sentry 2] & Sentinel3[Sentinel Sentry 3] -.->|Monitor and Failover| Master
    Master -->|Asynchronous Replication| Replica[(Redis Replica)]
    style SC1 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style SC2 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM1 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style LM2 fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Master fill:#18181b,stroke:#ec4899,color:#fff
    style Replica fill:#18181b,stroke:#a78bfa,color:#fff
        `} />

        <h2 className="guide-sub-heading" id="ports-keys">Service Ports & Redis Keys</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>Redis Key Pattern</th>
                <th style={{ padding: "12px 8px" }}>Type</th>
                <th style={{ padding: "12px 8px" }}>Owner</th>
                <th style={{ padding: "12px 8px" }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["rate:{userID}", "HASH", "Flat token bucket (/check)", "SOURCE-PROVEN"],
                ["sw:{userID}", "ZSET", "Sliding window (/check)", "SOURCE-PROVEN"],
                ["rate:global", "HASH", "Hierarchical global tier", "SOURCE-PROVEN"],
                ["rate:tenant:{t}", "HASH", "Hierarchical tenant tier", "SOURCE-PROVEN"],
                ["rate:user:{u}", "HASH", "Hierarchical user tier", "SOURCE-PROVEN"],
                ["rate:endpoint:{t}:{ep}", "HASH", "Hierarchical endpoint tier", "SOURCE-PROVEN"],
                ["config:{level}:{id}", "HASH", "Runtime override (capacity, refill_rate)", "SOURCE-PROVEN"],
                ["config:generation", "STRING", "Monotonic override version counter", "SOURCE-PROVEN"],
                ["cb:{target}", "HASH", "Circuit breaker (redis, central-limiter, gateway IDs)", "SOURCE-PROVEN"],
                ["idem:{scope}:{key}", "HASH", "Idempotency lease + fence token", "SOURCE-PROVEN"]
              ].map(([key, type, owner, evidence]) => (
                <tr key={key} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={{ padding: "12px 8px", fontFamily: "monospace", color: "#ff5cad" }}>{key}</td>
                  <td style={{ padding: "12px 8px" }}>{type}</td>
                  <td style={{ padding: "12px 8px", color: "#a1a1aa" }}>{owner}</td>
                  <td style={{ padding: "12px 8px" }}><RLEvidenceBadge type={evidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RLSourceExcerpt
          source="internal/circuitbreaker/types.go"
          establishes="सर्किट ब्रेकर के well-known टार्गेट: redis और central-limiter; राउटिंग मोड में गेटवे ID भी cb:{target} कुंजी पाते हैं।"
        >{`const (
    TargetRedis          = "redis"
    TargetCentralLimiter = "central-limiter"
)

// Redis key: cb:{"{target}"}  (internal/circuitbreaker/store.go)`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="boundaries">Service Boundaries & Roles</h2>
        <ul className="guide-bullets-list">
          <li><strong>Transparent Sidecar (<code>cmd/sidecar</code>, <code>:9090</code>):</strong> एज राउटिंग, इडेम्पोटेंसी रिप्ले, डिनायल-ओनली प्रोसेस-लोकल शील्डिंग, और <code>central-limiter</code> सर्किट ब्रेकर। डिफ़ॉल्ट <code>FAIL_OPEN=false</code> — लिमिटर डाउन होने पर 503।</li>
          <li><strong>Limiter Pool (<code>cmd/limiter</code>, <code>:8080</code>):</strong> स्टेटलेस, लीनियर स्केल। ओवरराइड कॉन्फ़िग पार्स करता है और Redis Lua के लिए bulk arguments तैयार करता है। ग्रेसफुल शटडाउन: <strong>5s</strong> drain timeout।</li>
          <li><strong>Admin API (<code>:8082</code>):</strong> नेटवर्क-आइसोलेटेड ओवरराइड CRUD। ओवरराइड लोकल कैश TTL: <code>OVERRIDE_CACHE_TTL_MS</code> डिफ़ॉल्ट <strong>5000ms</strong>।</li>
          <li><strong>Redis Master:</strong> एकल सीरियलाइज़िंग बॉटलनेक। सभी कोटा कटौती और लीज़ स्टेट की अधिकारिक स्रोत।</li>
        </ul>

        <RLRelatedPages pages={[
          { section: "introduction", slug: "start-here", title: "Start Here", note: "प्लेटफ़ॉर्म का परिचय" },
          { section: "request-routing", slug: "sidecar-architecture", title: "Sidecar Architecture", note: "प्रॉक्सी बाउंडरी विवरण" },
          { section: "production-engineering", slug: "deployment-topology", title: "Deployment Topology", note: "Docker और K8s टॉपोलॉजी" }
        ]} />
      </div>
    )
  },

  "anatomy-of-a-request": {
    title: "Anatomy of a Request",
    topics: [
      { label: "serveNormal Pipeline", href: "#serve-normal" },
      { label: "Allowed Pathway", href: "#allowed" },
      { label: "Rate-Limited Pathway", href: "#limited" },
      { label: "Idempotent Replay", href: "#idempotency" },
      { label: "Resilience Breakpoints", href: "#resilience" }
    ],
    content: (
      <div>
        <RLThesis>
          हर गैर-इडेम्पोटेंट अनुरोध <code>serveNormal</code> से गुज़रता है: पहले डिनायल कैश (केवल <code>Allowed=false</code>), फिर <code>singleflight</code> द्वारा संकुचित लिमिटर RPC, फिर <code>checkRateLimit</code> जो <code>central-limiter</code> सर्किट गार्ड और HTTP कॉल चलाता है, और अंत में अपस्ट्रीम फ़ॉरवर्ड या 429।
        </RLThesis>

        <RLQuickModel>
          कैश हिट + डिनायल = तुरंत 429 (लिमिटर बाईपास)। कैश हिट + अलाउ = लिमिटर पर फिर जाएगा (कोटा फ़्रीज़ अटैक रोक)। कैश मिस = singleflight → एक लिमिटर कॉल, 100 गोरoutines शेयर।
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="serve-normal">serveNormal Pipeline</h2>
        <DocsMermaid chart={`
flowchart TD
    Entry([serveNormal called]) --> Cache{Denial cache hit?\\nAllowed=false only}
    Cache -->|yes| Deny429[writeDenial 429]
    Cache -->|no or Allowed=true| SF[singleflight.Do cacheKey]
    SF --> CRL[checkRateLimit]
    CRL --> CB{Circuit cb:central-limiter}
    CB -->|Open| Err503[503 fail-closed]
    CB -->|Closed| LIM[HTTP GET /check_hierarchical]
    LIM --> Store[cache.Store result]
    Store --> Allowed{allowed?}
    Allowed -->|no| Deny429
    Allowed -->|yes| Forward[forwardRequest upstream]
    style Entry fill:#1e1e2e,stroke:#ff5cad,color:#fff
    style Deny429 fill:#1e1e2e,stroke:#ec4899,color:#fff
    style Forward fill:#1e1e2e,stroke:#c084fc,color:#fff
        `} />

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — serveNormal (lines 361-445)"
          establishes="डिनायल-ओनली कैश, singleflight संकुचन, और फ़ॉरवर्ड/डिनाय शाखा — सोर्स-प्रूव्ड क्रम।"
        >{`// singleflight: 100 concurrent requests for the same user share one limiter round-trip.
resultAny, err, _ := s.limitFlight.Do(cacheKey, func() (interface{}, error) {
    return s.checkRateLimit(ctx, r, userID, false)
})
if err != nil {
    if s.failOpen {
        s.forwardRequest(w, r)
        return
    }
    http.Error(w, "Rate limiter unavailable", http.StatusServiceUnavailable)
    return
}

result := resultAny.(limitResult)
s.cache.Store(cacheKey, CacheEntry{
    Allowed: result.allowed, ExpiresAt: time.Now().Add(s.ttl),
})
if !result.allowed {
    s.writeDenial(w, result.limit, result.remaining, result.retryAfter)
    return
}
s.forwardRequest(w, r)`}</RLSourceExcerpt>

        <RLCallout variant="info" title="Denial cache TTL">
          डिफ़ॉल्ट <code>CACHE_TTL_MS = 30ms</code> (<code>cmd/sidecar/main.go</code> <code>main()</code>)। पुराने 1000ms/1s दावे गलत थे — सोर्स में हार्डकोडेड <code>30 * time.Millisecond</code> है।
        </RLCallout>

        <h2 className="guide-sub-heading" id="allowed">1. The Allowed Request</h2>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li>क्लाइंट <code>GET /items</code> साइडकार (<code>:9090</code>) पर भेजता है।</li>
          <li><code>ServeHTTP</code> यूज़र ID रिज़ॉल्व करता है; इडेम्पोटेंसी-की नहीं है → <code>serveNormal</code>।</li>
          <li>डिनायल कैश मिस; <code>singleflight.Do</code> एक <code>/check_hierarchical</code> कॉल शुरू करता है।</li>
          <li>लिमिटर <code>config:generation</code> चेक करता है, ओवरराइड लोड करता है (<code>OVERRIDE_CACHE_TTL_MS</code> ≤ 5s)।</li>
          <li>Limiter runs <code>EVALSHA hierarchical.lua</code> — KEYS: <code>rate:global</code>, <code>rate:tenant:{"{t}"}</code>, <code>rate:user:{"{u}"}</code>, <code>rate:endpoint:{"{t}"}:{"{ep}"}</code>.</li>
          <li>Redis Lua सभी टियर अप्रूव करता है, टोकन घटाता है, <code>{"{allowed: 1, remaining: N}"}</code> लौटाता है।</li>
          <li>लिमिटर <code>200 OK</code> + रेट-लिमिट हेडर लौटाता है।</li>
          <li>साइडकार परिणाम स्टोर करता है (अलाउ होने पर भी अगली बार फिर चेक), अपस्ट्रीम (<code>:8081</code>) फ़ॉरवर्ड करता है।</li>
        </ol>

        <h2 className="guide-sub-heading" id="limited">2. The Rate-Limited Request</h2>
        <p>जब Redis Lua किसी टियर पर टोकन समाप्त पाता है:</p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li><code>hierarchical.lua</code> रिफ़िल स्टेट लिखता है पर किसी टियर से टोकन नहीं काटता — <code>return {"{0, 0}"}</code>।</li>
          <li>लिमिटर साइडकार को <code>429 Too Many Requests</code> लौटाता है।</li>
          <li>साइडकार <code>sync.Map</code> में डिनायल एंट्री स्टोर करता है (<code>CACHE_TTL_MS</code> = 30ms डिफ़ॉल्ट)।</li>
          <li>क्लाइंट को <code>429</code> + <code>Retry-After</code> मिलता है।</li>
          <li>अगले 30ms में समान कुंजी पर अनुरोध साइडकार से तुरंत 429 — लिमिटर और Redis बाईपास।</li>
        </ol>

        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — denied path (lines 55-72)"
          establishes="अस्वीकृति पर कोई टियर से टोकन नहीं कटता — केवल रिफ़िल स्टेट अपडेट; all-or-nothing invariant।"
          language="lua"
        >{`if allowed == 1 then
    for i = 1, levels do
        local updated_tokens = level_new_tokens[i] - requested
        redis.call('HMSET', key, 'tokens', updated_tokens, 'last_refill', now)
    end
    remaining = math.floor(min_remaining - requested)
else
    for i = 1, levels do
        redis.call('HMSET', key, 'tokens', level_new_tokens[i], 'last_refill', now)
    end
    remaining = 0
end
return {allowed, remaining}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="idempotency">3. The Idempotent Request</h2>
        <p>यदि क्लाइंट <code>Idempotency-Key</code> के साथ POST भेजता है:</p>
        <ol className="guide-bullets-list" style={{ listStyleType: "decimal" }}>
          <li><code>ServeHTTP</code> म्यूटेटिंग मेथड + की मिलने पर <code>serveIdempotent</code> शाखा।</li>
          <li>Redis <code>idem:{"{scope}"}:{"{key}"}</code> via <code>claim.lua</code> — generates a fence token.</li>
          <li><code>completed</code> → कैश्ड स्टेटस/बॉडी रिप्ले; अपस्ट्रीम कॉल नहीं।</li>
          <li><code>processing</code> → <code>409 Conflict</code> या retry-after।</li>
          <li>नया क्लेम → <code>checkRateLimit</code> → अपस्ट्रीम → <code>complete.lua</code> फ़ेंस चेक के साथ।</li>
        </ol>

        <h2 className="guide-sub-heading" id="resilience">4. Resilience Breakpoints</h2>
        <p>Redis या लिमिटर विफल होने पर:</p>
        <ul className="guide-bullets-list">
          <li>लिमिटर का <code>cb:redis</code> सर्किट गार्ड Redis टाइमआउट रिकॉर्ड करता है (डिफ़ॉल्ट dial/read/write <strong>500ms</strong>, pool <strong>1000ms</strong>)।</li>
          <li>साइडकार <code>checkRateLimit</code> में <code>cb:central-limiter</code> — Open होने पर तुरंत 503 (डिफ़ॉल्ट <code>FAIL_OPEN=false</code>)।</li>
          <li>साइडकार→लिमिटर HTTP टाइमआउट: <code>SIDECAR_LIMITER_HTTP_TIMEOUT_MS</code> डिफ़ॉल्ट <strong>1500ms</strong>।</li>
          <li>429 अपेक्षित डिनायल है — सर्किट ब्रेकर आँकड़ों से बाहर (<code>ClassifyHTTP</code>)।</li>
        </ul>

        <RLSourceExcerpt
          source="cmd/sidecar/main.go — checkRateLimit circuit guard"
          establishes="central-limiter सर्किट Allow/Record हर लिमिटर RPC से पहले और बाद में।"
        >{`if s.limiterCircuit != nil {
    allow, err := s.limiterCircuit.Allow(ctx, circuitbreaker.TargetCentralLimiter)
    if err != nil && !s.limiterCircuit.Config().FailOpen {
        return limitResult{}, fmt.Errorf("circuit breaker unavailable: %w", err)
    } else if !allow.Allowed {
        return limitResult{}, fmt.Errorf("central limiter circuit %s", allow.State)
    }
}
// ... HTTP GET to /check_hierarchical
defer func() {
    input := circuitbreaker.ClassifyHTTP(callErr, statusCode, time.Since(start), ...)
    _ = s.limiterCircuit.Record(ctx, circuitbreaker.TargetCentralLimiter, input)
}()`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight" },
          { section: "resilience", slug: "circuit-breaker", title: "Circuit Breaker" },
          { section: "resilience", slug: "idempotency", title: "Idempotency" },
          { section: "rate-limiting-engine", slug: "hierarchical-quotas", title: "Hierarchical Quotas" }
        ]} />
      </div>
    )
  },

  "why-this-architecture": {
    title: "Why This Architecture?",
    topics: [
      { label: "Why Sidecar Boundary?", href: "#sidecar-why" },
      { label: "Why Central Limiter?", href: "#limiter-why" },
      { label: "Why Redis + Lua?", href: "#redis-why" },
      { label: "Why Circuit Breaker?", href: "#cb-why" }
    ],
    content: (
      <div>
        <RLThesis>
          हर आर्किटेक्चरल सीमा एक विशिष्ट ऑपरेशनल या परफ़ॉर्मेंस बाधा को पूरा करने के लिए चुनी गई है — भाषा-अज्ञेयवादी एज एनफ़ोर्समेंट, कनेक्शन कंसेंट्रेशन, अटॉमिक कोटा, और कैस्केडिंग फ़ेलियर से सुरक्षा।
        </RLThesis>

        <RLQuickModel>
          साइडकार = एज शील्ड + डिनायल ऑफ़लोड। लिमिटर = स्टेटलेस Redis शील्ड। Redis+Lua = एकल-थ्रेड अटॉमिकिटी। सर्किट = <code>cb:redis</code>, <code>cb:central-limiter</code>, <code>cb:{"{gateway-id}"}</code>।
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="sidecar-why">Why Sidecar Boundary?</h2>
        <p>
          एप्लिकेशन कोड में रेट लिमिटिंग एम्बेड करना बिज़नेस लॉजिक को नेटवर्क लाइब्रेरी से जोड़ता है। अलग साइडकार (<code>cmd/sidecar</code>, <code>:9090</code>) भाषा-अज्ञेयवादी एनफ़ोर्समेंट, मानकीकृत ट्रेस प्रोपेगेशन, और स्वतंत्र डिप्लॉय स्केलिंग देता है।
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — ServeHTTP entry"
          establishes="साइडकार सभी प्रॉक्सी ट्रैफ़िक का एकमात्र क्लाइंट-फेसिंग एंट्री पॉइंट; इडेम्पोटेंसी vs serveNormal शाखा।"
        >{`func (s *Sidecar) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    userID, err := identity.ResolveUserID(r, s.allowQueryUserID)
    idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
    if s.idempotency != nil && idemKey != "" && idempotency.IsMutatingMethod(r.Method) {
        s.serveIdempotent(w, r, userID, idemKey)
        return
    }
    s.serveNormal(w, r, userID)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="limiter-why">Why Central Limiter?</h2>
        <p>
          हर साइडकार इंस्टेंस का सीधा Redis कनेक्शन 1000+ साइडकार क्लस्टर में कनेक्शन पूल थकावट का जोखिम बनाता है। सेंट्रल लिमिटर (<code>:8080</code>) स्टेटलेस कनेक्शन कंसेंट्रेटर है — HTTP चेक क्वेरी को Redis कमांड में अनुवाद करता है। एडमिन (<code>:8082</code>) हॉट पाथ से अलग।
        </p>

        <h2 className="guide-sub-heading" id="redis-why">Why Redis + Lua?</h2>
        <p>
          Redis प्रति-कुंजी सिंगल-थ्रेडेड एक्ज़ीक्यूशन देता है। Lua स्क्रिप्ट में टोकन बकेट गणना चेक और राइट को एक अविभाज्य ऑपरेशन बनाती है — समानांतर क्लाइंट रेस कंडीशन समाप्त।
        </p>
        <RLCallout variant="limitation" title="Redis Cluster incompatibility">
          <code>hierarchical.lua</code> चार अलग KEYS (<code>rate:global</code>, <code>rate:tenant:*</code>, …) एक साथ टच करता है। Redis Cluster में ये अलग-अलग स्लॉट्स पर हैश होते हैं → <code>CROSSSLOT</code> एरर। मल्टी-की अटॉमिकिटी के लिए सिंगल-मास्टर या Sentinel टोपोलॉजी आवश्यक; हैश टैग ({`{tenant}`}) के बिना Cluster असंगत। <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <h2 className="guide-sub-heading" id="cb-why">Why Distributed Circuit Breakers?</h2>
        <p>
          लिमिटर या Redis आउटेज कैस्केड नहीं करनी चाहिए। सर्किट स्टेट Redis HASH <code>cb:{"{target}"}</code> में साझा है — सभी साइडकार रेप्लिका एक ही <code>central-limiter</code> या गेटवे हेल्थ देखती हैं।
        </p>
        <ul className="guide-bullets-list">
          <li><code>cb:redis</code> — लिमिटर प्रोसेस में Redis गार्ड</li>
          <li><code>cb:central-limiter</code> — साइडकार→लिमिटर RPC गार्ड</li>
          <li><code>cb:{"{gateway-id}"}</code> — राउटिंग मोड में प्रति-गेटवे गार्ड</li>
        </ul>

        <RLRelatedPages pages={[
          { section: "introduction", slug: "the-problem", title: "The Problem", note: "TOCTOU और ओवर-एडमिशन" },
          { section: "rate-limiting-engine", slug: "redis-lua-atomicity", title: "Redis + Lua Atomicity" },
          { section: "resilience", slug: "failure-model", title: "Failure Model" }
        ]} />
      </div>
    )
  },

  "distributed-state-model": {
    title: "Distributed State Model",
    topics: [
      { label: "State Ownership Matrix", href: "#matrix" },
      { label: "Redis Key Catalog", href: "#key-catalog" },
      { label: "Synchronization Models", href: "#sync" },
      { label: "Restart Behavior", href: "#restart" }
    ],
    content: (
      <div>
        <RLThesis>
          रेट लिमिटिंग तीन स्टेट श्रेणियों को समन्वित करती है: अधिकारिक Redis स्टेट (कोटा, ओवरराइड, सर्किट, इडेम्पोटेंसी), प्रोसेस-लोकल एफ़ेमेरल कैश (डिनायल-ओनली), और जनरेशन-वैलिडेटेड ओवरराइड लोकल कैश (≤ 5s TTL)।
        </RLThesis>

        <RLQuickModel>
          Redis = सत्य का स्रोत। साइडकार sync.Map = डिनायल शील्ड (30ms)। लिमिटर ओवरराइड कैश = Redis पढ़ाई कम करने के लिए; <code>config:generation</code> बदलने पर तुरंत invalidate।
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="matrix">Authoritative State Ownership Matrix</h2>
        <div style={{ overflowX: "auto", margin: "20px 0" }}>
          <table className="guide-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #27272a", textAlign: "left" }}>
                <th style={{ padding: "12px 8px" }}>State Category</th>
                <th style={{ padding: "12px 8px" }}>Primary Owner</th>
                <th style={{ padding: "12px 8px" }}>Redis Key</th>
                <th style={{ padding: "12px 8px" }}>Consistency</th>
                <th style={{ padding: "12px 8px" }}>Restart Durability</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Flat Rate Quotas</td>
                <td>Redis Master</td>
                <td><code>rate:{"{userID}"}</code> / <code>sw:{"{userID}"}</code></td>
                <td>Strong (Lua atomic)</td>
                <td>Durable (AOF/RDB)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Hierarchical Quotas</td>
                <td>Redis Master</td>
                <td><code>rate:global</code>, <code>rate:tenant:*</code>, <code>rate:user:*</code>, <code>rate:endpoint:*:*</code></td>
                <td>Strong (multi-key Lua)</td>
                <td>Durable</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Overrides</td>
                <td>Redis Master</td>
                <td><code>config:{"{level}"}:{"{id}"}</code> + <code>config:generation</code></td>
                <td>Optimistic generation</td>
                <td>Durable</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Circuit State</td>
                <td>Shared Redis</td>
                <td><code>cb:{"{target}"}</code></td>
                <td>Eventual (Redis HASH)</td>
                <td>Durable</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Idempotency Locks</td>
                <td>Shared Redis</td>
                <td><code>idem:{"{scope}"}:{"{key}"}</code></td>
                <td>Strict fence lock</td>
                <td>Durable</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Denial Cache</td>
                <td>Sidecar Proxy</td>
                <td>Memory (<code>sync.Map</code>)</td>
                <td>Local-only, denials only</td>
                <td>Ephemeral (wiped on restart)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <td style={{ padding: "12px 8px", fontWeight: "bold" }}>Override Local Cache</td>
                <td>Limiter process</td>
                <td>In-memory TTL map</td>
                <td>≤ <code>OVERRIDE_CACHE_TTL_MS</code> (5000ms)</td>
                <td>Ephemeral</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="guide-sub-heading" id="key-catalog">Redis Key Catalog</h2>
        <RLSourceExcerpt
          source="cmd/limiter/main.go — hierarchical key construction"
          establishes="हाइरार्किकल चेक पर चार KEYS की सटीक पैटर्न।"
        >{`globalKey := "rate:global"
tenantKey := fmt.Sprintf("rate:tenant:%s", tenantID)
userKey := fmt.Sprintf("rate:user:%s", userID)
endpointKey := fmt.Sprintf("rate:endpoint:%s:%s", tenantID, endpoint)`}</RLSourceExcerpt>

        <RLSourceExcerpt
          source="internal/override/override.go"
          establishes="ओवरराइड कुंजी और जनरेशन काउंटर पैटर्न।"
        >{`const generationKey = "config:generation"

func configKey(level, id string) string {
    return fmt.Sprintf("config:%s:%s", level, id)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="sync">Synchronization Model</h2>
        <ul className="guide-bullets-list">
          <li><strong>Database Atomic Serialization:</strong> कोटा चेक Lua स्क्रिप्ट्स Redis सिंगल थ्रेड पर सीरियल।</li>
          <li><strong>Optimistic Generation Checking:</strong> हर <code>/check_hierarchical</code> पर <code>config:generation</code> पढ़ाई; बदलाव पर लोकल ओवरराइड कैश invalidate। Redis GET फ़ेल होने पर TTL-bound स्टेलनेस (≤ 5s)।</li>
          <li><strong>Denial-Only Edge Cache:</strong> <code>CACHE_TTL_MS</code> (30ms) — अलाउ कभी कैश से स्किप नहीं।</li>
        </ul>

        <RLSourceExcerpt
          source="cmd/limiter/config.go — OVERRIDE_CACHE_TTL_MS"
          establishes="ओवरराइड लोकल कैश डिफ़ॉल्ट 5000ms।"
        >{`OverrideCacheTTLMs: mustParseIntEnv("OVERRIDE_CACHE_TTL_MS", "5000", strict),`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="restart">Restart Behavior</h2>
        <p>
          लिमिटर और साइडकार रीस्टार्ट पर इन-मेमोरी स्टेट खो देते हैं; Redis स्टेट बनी रहती है। ग्रेसफुल शटडाउन <strong>5s</strong> HTTP drain देता है (<code>cmd/limiter/main.go</code>, <code>cmd/sidecar/main.go</code>) — 15s नहीं।
        </p>
        <RLSourceExcerpt
          source="cmd/limiter/main.go — graceful shutdown"
          establishes="SIGTERM/SIGINT पर 5*time.Second shutdown context।"
        >{`ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if err := srv.Shutdown(ctx); err != nil {
    logging.Fatal("Server forced to shutdown", "error", err)
}`}</RLSourceExcerpt>

        <RLRelatedPages pages={[
          { section: "rate-limiting-engine", slug: "configuration-overrides", title: "Configuration Overrides" },
          { section: "production-engineering", slug: "graceful-shutdown", title: "Graceful Shutdown" },
          { section: "correctness-and-verification", slug: "multi-replica-verification", title: "Multi-Replica Verification" }
        ]} />
      </div>
    )
  },

  "system-invariants": {
    title: "System Invariants",
    topics: [
      { label: "Defined Invariants", href: "#invariants" },
      { label: "Hierarchical All-or-Nothing", href: "#hierarchical-proof" },
      { label: "Denial Cache Safety", href: "#denial-safety" },
      { label: "Verification Mechanisms", href: "#proofs" }
    ],
    content: (
      <div>
        <RLThesis>
          इनवेरिएंट वे सहीता गुण हैं जो समानांतरता, नेटवर्क विभाजन, और नोड फ़ेलियर के तहत भी सत्य रहने चाहिए — विशेषकर हाइरार्किकल all-or-nothing कटौती और डिनायल-ओनली कैश सुरक्षा।
        </RLThesis>

        <RLQuickModel>
          Lua = अटॉमिक कोटा। hierarchical.lua denied = शून्य कटौती। डिनायल कैश = केवल 429 तेज़ कर सकता है, कभी अलाउ नहीं। फ़ेंस टोकन = स्टेल राइटर ब्लॉक।
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="invariants">Core System Invariants</h2>
        <ul className="guide-bullets-list">
          <li><strong>Invariant 1: Quota Upper Bound</strong> — कनेक्टेड Redis पर अनुमत अनुरोध सीमा से अधिक नहीं। Lua सिंगल-थ्रेड सीरियलाइज़ेशन ओवर-एडमिशन असंभव। <RLEvidenceBadge type="SOURCE-PROVEN" /> <RLEvidenceBadge type="TEST-PROVEN" /></li>
          <li><strong>Invariant 2: Multi-Key Atomicity (All-or-Nothing)</strong> — हाइरार्किकल चेक में यदि कोई एक टियर अस्वीकार करता है, किसी भी टियर से टोकन नहीं कटता। <code>hierarchical.lua</code> में <code>allowed == 0</code> शाखा केवल रिफ़िल स्टेट लिखती है। <RLEvidenceBadge type="SOURCE-PROVEN" /></li>
          <li><strong>Invariant 3: Idempotency Lease Integrity</strong> — एक्सपायर्ड लीज़ वाला साइडकार नए लीज़-होल्डर के परिणाम को ओवरराइट नहीं कर सकता; फ़ेंस टोकन चेक। <RLEvidenceBadge type="TEST-PROVEN" /></li>
          <li><strong>Invariant 4: Safe Denial Cache Offloading</strong> — साइडकार डिनायल कैश केवल <code>Allowed=false</code> हिट पर लिमिटर बाईपास करता है; <code>Allowed=true</code> एंट्री हमेशा फिर से चेक होती है। कोटा समाप्त होने पर भी कैश अलाउ नहीं कर सकता। <RLEvidenceBadge type="SOURCE-PROVEN" /></li>
        </ul>

        <h2 className="guide-sub-heading" id="hierarchical-proof">Hierarchical All-or-Nothing Proof</h2>
        <p>
          <code>hierarchical.lua</code> दो चरणों में चलता है: (1) सभी चार टियर रिफ़िल + जाँच, (2) केवल <code>allowed == 1</code> होने पर सभी से <code>requested</code> (हमेशा 1) घटाना। अस्वीकृति पर चरण 2 स्किप — कोई टोकन कटौती नहीं।
        </p>
        <RLSourceExcerpt
          source="internal/limiter/lua/hierarchical.lua — Step 1 check (lines 43-46)"
          establishes="किसी भी टियर पर अपर्याप्त टोकन → allowed=0; अभी भी अन्य टियर जाँच जारी (min_remaining ट्रैक)।"
          language="lua"
        >{`if math.floor(new_tokens) < requested then
    allowed = 0
end`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="denial-safety">Denial Cache Safety</h2>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — denial-only cache hit (lines 377-393)"
          establishes="केवल !entry.Allowed पर कैश से 429; Allowed=true एंट्री लॉग होती है पर limiter skip नहीं।"
        >{`if !entry.Allowed {
    s.writeDenial(w, entry.Limit, entry.Remaining, entry.RetryAfter)
    return
}
logging.Debug(ctx, "allowed cache entry ignored", ...)`}</RLSourceExcerpt>

        <RLCallout variant="warning" title="Intentional over-denial window">
          30ms डिनायल कैश TTL के दौरान कोटा रिफ़िल हो जाए तो भी साइडकार 429 दे सकता है — यह जानबूझकर ट्रेड-ऑफ़ है (अब्यूज़ शील्डिंग बनाम सब-30ms स्टेल डिनायल)। यह invariant 4 का दूसरा पक्ष: कभी अंडर-एनफ़ोर्स नहीं।
        </RLCallout>

        <h2 className="guide-sub-heading" id="proofs">Verification Mechanisms</h2>
        <p>
          इनवेरिएंट <code>go test -race ./...</code> रेस-डिटेक्टर सूट और Redis Sentinel फ़ेलओवर chaos परिदृश्यों से सत्यापित। मल्टी-रेप्लिका हाइरार्किकल टेस्ट साबित करता है कि दो लिमिटर रेप्लिका साझा Redis पर ओवर-एडमिट नहीं करतीं। <RLEvidenceBadge type="RUNTIME-PROVEN" />
        </p>

        <RLRelatedPages pages={[
          { section: "rate-limiting-engine", slug: "multi-replica-correctness", title: "Multi-Replica Correctness" },
          { section: "correctness-and-verification", slug: "multi-replica-verification", title: "Multi-Replica Verification" },
          { section: "rate-limiting-engine", slug: "hierarchical-quotas", title: "Hierarchical Quotas" },
          { section: "resilience", slug: "denial-cache-and-singleflight", title: "Denial Cache & Singleflight" }
        ]} />
      </div>
    )
  },

  "engineering-trade-offs": {
    title: "Engineering Trade-offs",
    topics: [
      { label: "Consistency vs. Availability", href: "#cap" },
      { label: "Lua vs. Redis Cluster", href: "#cluster" },
      { label: "Denial Cache Staleness", href: "#denial-stale" },
      { label: "Duplicate Suppression vs. Exactly Once", href: "#suppression" }
    ],
    content: (
      <div>
        <RLThesis>
          हर डिज़ाइन निर्णय एक बाधा को प्राथमिकता देता है: फ़ेल-क्लोज़ड डिफ़ॉल्ट downstream सुरक्षा, मल्टी-की Lua सहीता बनाम Cluster स्केल, 30ms डिनायल कैश अब्यूज़ शील्ड बनाम सब-30ms स्टेलनेस, और इडेम्पोटेंसी at-most-once upstream।
        </RLThesis>

        <RLQuickModel>
          फ़ेल-क्लोज़ड (डिफ़ॉल्ट) &gt; फ़ेल-ओपन। सिंगल Redis मास्टर &gt; Cluster (हाइरार्किकल Lua)। डिनायल कैश = शॉर्ट TTL शील्ड, अलाउ कभी कैश नहीं।
        </RLQuickModel>

        <h2 className="guide-sub-heading" id="cap">Consistency vs. Availability (Fail-Closed default)</h2>
        <ul className="guide-bullets-list">
          <li><strong>Fail-Open (<code>FAIL_OPEN=true</code>):</strong> लिमिटर डाउन होने पर ट्रैफ़िक पास — UX बचाता है, downstream ओवरलोड जोखिम।</li>
          <li><strong>Fail-Closed (चुना गया, डिफ़ॉल्ट):</strong> <code>FAIL_OPEN</code> unset या <code>false</code> → 503। Downstream ओवरलोड से बचाता है; लिमिटर उपलब्धता hard dependency।</li>
        </ul>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — FAIL_OPEN default"
          establishes="डिफ़ॉल्ट fail-closed; केवल env=true पर fail-open फ़ॉरवर्ड।"
        >{`failOpen := os.Getenv("FAIL_OPEN") == "true"
// ...
if err != nil {
    if s.failOpen {
        s.forwardRequest(w, r)
        return
    }
    http.Error(w, "Rate limiter unavailable", http.StatusServiceUnavailable)
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="cluster">Lua Scripting vs. Redis Cluster Incompatibility</h2>
        <p>
          मल्टी-की Lua स्क्रिप्ट अटॉमिक मल्टी-टियर कोटा लागू करती है, पर सभी KEYS को एक Redis प्रोसेस पर बाँधती है। Redis Cluster keys को 16,384 स्लॉट्स में शार्ड करता है — अलग namespace की keys अलग स्लॉट्स → <code>CROSSSLOT</code>।
        </p>
        <RLCallout variant="limitation" title="Accepted throughput ceiling">
          अटॉमिक हाइरार्किकल सहीता बनाए रखने के लिए सिंगल-मास्टर टोपोलॉजी स्वीकार की गई (~870 sustainable RPS, p99 ≈ 11ms)। Cluster समर्थन के लिए सभी keys पर साझा hash tag (जैसे <code>rate:{"{rl}"}:global</code>) आवश्यक — व्यावहारिक रूप से सभी ट्रैफ़िक एक नोड पर केंद्रित। <RLEvidenceBadge type="DOCUMENTED LIMITATION" /> <RLEvidenceBadge type="BENCHMARK-PROVEN" />
        </RLCallout>

        <h2 className="guide-sub-heading" id="denial-stale">Denial Cache Staleness Trade-off</h2>
        <RLStatGrid stats={[
          { value: "30ms", label: "CACHE_TTL_MS default", color: "#c084fc", evidence: "SOURCE-PROVEN" },
          { value: "5000ms", label: "OVERRIDE_CACHE_TTL_MS default", color: "#a78bfa", evidence: "SOURCE-PROVEN" },
          { value: "5s", label: "Graceful shutdown drain", color: "#22c55e", evidence: "SOURCE-PROVEN" }
        ]} />
        <p>
          30ms डिनायल विंडो Redis/Limiter लोड कम करती है पर कोटा रिफ़िल के बाद भी संक्षेप 429 दे सकती है। अलाउ कैशिंग से बचकर कोटा-फ़्रीज़ अटैक वेक्टर बंद रखा गया।
        </p>
        <RLSourceExcerpt
          source="cmd/sidecar/main.go — CACHE_TTL_MS default"
          establishes="हार्डकोडेड 30ms डिफ़ॉल्ट; env से ओवरराइड।"
        >{`ttl := 30 * time.Millisecond
if raw := os.Getenv("CACHE_TTL_MS"); raw != "" {
    if ms, err := strconv.Atoi(raw); err == nil && ms > 0 {
        ttl = time.Duration(ms) * time.Millisecond
    }
}`}</RLSourceExcerpt>

        <h2 className="guide-sub-heading" id="suppression">Duplicate Suppression vs. Exactly-Once Upstreams</h2>
        <p>
          इडेम्पोटेंसी लेयर (<code>idem:{"{scope}"}:{"{key}"}</code>) समवर्ती दोहराव दबाती और प्रतिक्रिया कैश करती है। यह upstream side-effects के लिए exactly-once गारंटी नहीं देती — साइडकार क्रैश के बाद रिट्राई दूसरी बार अपस्ट्रीम कॉल कर सकता है।
        </p>
        <RLCallout variant="limitation" title="Documented scope boundary">
          वित्तीय लेनदेन जैसे वर्कलोड में upstream डेटाबेस में idempotent side-effects आवश्यक। प्रॉक्सी लेयर at-most-once suppression प्रदान करती है, exactly-once नहीं। <RLEvidenceBadge type="DOCUMENTED LIMITATION" />
        </RLCallout>

        <RLRelatedPages pages={[
          { section: "introduction", slug: "guarantees-and-limitations", title: "Guarantees & Limitations" },
          { section: "performance-lab", slug: "throughput-and-saturation", title: "Throughput & Saturation" },
          { section: "production-engineering", slug: "configuration-reference", title: "Configuration Reference" }
        ]} />
      </div>
    )
  }
};
