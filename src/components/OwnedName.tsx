import { Calendar, ExternalLink, Globe } from "lucide-react";
import { daysRemaining, getARIO } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import {  AoArNSNameData } from "@ar.io/sdk"
import { ArNSName } from "@/types";

const OwnedName = ({ domain }: { domain: ArNSName }) => {

    const { data: arnsOwnershipData, isLoading:isArnsOwnershipDataLoading } = useQuery({
        queryKey: ["domainOwnershipPeriod", domain.name],
        queryFn: async(): Promise<AoArNSNameData | null> => {
            const ario = getARIO();
            const record = await ario.getArNSRecord({ name: domain.name })
            return record ?? null;
        },
         enabled: !!domain.name
    });

  return (
    <div
      className="bg-card rounded-2xl border border-primary/20 p-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Domain Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <h3 className="font-heading font-bold text-lg text-foreground">
                {domain.displayName}.ar.io
              </h3>
              {domain.displayName !== domain.name && (
                <p className="text-xs text-foreground/80">
                  Raw name: {domain.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            {domain.lastUpdated && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-foreground/80" />
                <span className="text-foreground/80">
                  Registered: {domain.lastUpdated.toLocaleDateString()}
                </span>
              </div>
            )}

            {isArnsOwnershipDataLoading ? (
              <div className="h-4 w-32 bg-foreground/10 rounded animate-pulse" />
            ) : (
                <span className="text-xs text-foreground/80">
                {arnsOwnershipData?.type === "permabuy"
                ? "Permanently owned"
                : `Leased (expires in ${daysRemaining(new Date(arnsOwnershipData?.endTimestamp??0))} days)`}
                </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
          <button
            onClick={() =>
              window.open(`https://${domain.name}.ar.io`, "_blank")
            }
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit
          </button>
          <button
            onClick={() =>
              window.open(
                `https://arns.ar.io/#/manage/names/${domain.name}`,
                "_blank",
              )
            }
            className="flex items-center justify-center gap-2 px-4 py-2 bg-card border border-primary/30 rounded-full text-foreground hover:bg-primary/10 transition-colors"
          >
            <Globe className="w-4 h-4" />
            Manage
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnedName;
