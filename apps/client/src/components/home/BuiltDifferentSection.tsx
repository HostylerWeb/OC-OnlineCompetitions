import {
  HOME_BUILT_DIFFERENT as HOME_BUILT_DIFFERENT_EN,
  HOME_FEATURES as HOME_FEATURES_EN,
} from "@oc/content/home";
import { Shield, Users, Zap } from "@oc/icons";
const iconMap = { Shield, Zap, Users } as const;

export function BuiltDifferentSection() {
  const builtDifferent = HOME_BUILT_DIFFERENT_EN;
  const features = HOME_FEATURES_EN;
  const featuredFeature = features.find((f) => f.variant === "featured");
  const sideFeatures = features.filter((f) => f.variant === "side");

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-gradient-to-b from-card/30 to-background relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />

      <div className="oc-container-wide relative z-10">
        <div className="mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tighter leading-none mb-3 sm:mb-4">
            <span className="text-gold">{builtDifferent.title}</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl">
            {builtDifferent.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {featuredFeature && (
            <div className="lg:col-span-2">
              <div className="h-full rounded-2xl border border-gold/10 bg-card p-6 shadow-sm transition-colors duration-300 hover:border-gold/30 sm:p-8 md:p-12">
                <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4 md:space-x-6">
                  {(() => {
                    const FeaturedIcon = iconMap[featuredFeature.icon];
                    return (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                        <FeaturedIcon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-gold" />
                      </div>
                    );
                  })()}
                  <div className="space-y-3 sm:space-y-4">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {featuredFeature.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg">
                      {featuredFeature.description}
                    </p>
                    {featuredFeature.badges && (
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
                        {featuredFeature.badges.map((badge) => (
                          <div key={badge.label} className="flex items-center space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full ${badge.color === "green" ? "bg-green-500" : "bg-gold"}`}
                            />
                            <span className="text-xs sm:text-sm font-medium text-foreground">
                              {badge.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {sideFeatures.map((feature) => {
              const SideIcon = iconMap[feature.icon];
              return (
                <div
                  key={feature.id}
                  className="rounded-2xl border border-gold/10 bg-card p-5 shadow-sm transition-colors duration-300 hover:border-gold/30 sm:p-6 md:p-8"
                >
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <SideIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <h4 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                        {feature.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
